// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DataVaultRewards
 * @notice Privacy-First AI Marketplace — on-chain contribution & reward ledger.
 *
 * Mirrors the semantics of the DataVault TypeScript local ledger
 * (`src/server/blockchain/ledger.ts`): REGISTER_PARTICIPANT →
 * RECORD_CONTRIBUTION → ALLOCATE_REWARD → CLAIM_REWARD.
 *
 * ── DATA token design ─────────────────────────────────────────────────────
 * DATA is an INTERNAL ACCOUNTING UNIT, not an ERC-20 token. Amounts are
 * `uint256` in 2-decimal fixed-point (SCALE = 1e2, i.e. 450.00 DATA = 45000
 * units). This choice exactly matches the off-chain reward engine
 * (`src/server/rewards/reward-engine.ts` rounds rewards to 2 decimals with a
 * 1000 DATA round pool), avoids floats, and keeps the demo free of token
 * plumbing. A production deployment would wrap this in an ERC-20 or use a
 * native stablecoin; the accounting math is unchanged.
 *
 * Contribution scores are 6-decimal fixed-point (SCORE_SCALE = 1e6) matching
 * the backend's `normalizedScore` precision (0.45 → 450000).
 *
 * ── Privacy policy (spec §52) ─────────────────────────────────────────────
 * ONLY hashes, proofs and reward amounts go on-chain. Never raw records,
 * personal data, model weights, or dataset content. `contributionHash` is a
 * SHA-256 digest of a privacy-protected model update.
 *
 * ── Reward formula (spec §37) ─────────────────────────────────────────────
 *   participant_reward = ROUND_REWARD_POOL × normalized_contribution_score
 * The coordinator (backend) computes normalized scores off-chain from real
 * training telemetry and calls `allocateReward` with the result; the contract
 * enforces pool accounting, one allocation per (participant, round), and
 * pull-based claims.
 *
 * ── Safety ────────────────────────────────────────────────────────────────
 * - `onlyCoordinator` (deployer) guards all write actions.
 * - Checks-effects-interactions: state is fully updated before any emit; the
 *   contract performs ZERO external calls (DATA is internal accounting), so
 *   reentrancy is impossible by construction. A mutex is included anyway as
 *   defense-in-depth for future upgrades.
 * - No unbounded loops, no storage of raw data, no admin transfer of funds.
 */
contract DataVaultRewards {
    // ── precision constants ──
    uint256 public constant SCALE = 1e2;        // DATA 2-decimal units
    uint256 public constant SCORE_SCALE = 1e6;  // score 6-decimal units

    // ── access control ──
    address public immutable coordinator;

    // ── participant registry (addresses only — no personal data on-chain) ──
    struct Participant {
        bool registered;
        uint256 contributionCount; // lifetime number of recorded contributions
        uint256 lifetimeScore;     // Σ normalized scores, SCORE_SCALE precision
        uint256 lastRoundId;
        uint256 pendingRewards;    // allocated but not yet claimed, SCALE units
        uint256 claimedRewards;    // lifetime claimed, SCALE units
        uint256 totalAllocated;    // lifetime allocated, SCALE units
    }

    struct RoundContribution {
        bool recorded;
        bytes32 contributionHash; // SHA-256 digest of the protected update (proof only)
        uint256 score;            // normalized contribution score, SCORE_SCALE units
    }

    mapping(address => Participant) private participants;
    mapping(address => mapping(uint256 => RoundContribution)) private roundContributions;
    mapping(address => mapping(uint256 => uint256)) private roundRewardsAllocated; // per (participant, round)
    mapping(uint256 => uint256) public roundFunded;    // reward pool funded per round
    mapping(uint256 => uint256) public roundAllocated; // reward pool allocated per round

    // ── global accounting (SCALE units) ──
    uint256 public totalFunded;   // Σ round pools ever funded
    uint256 public totalAllocated; // Σ rewards ever allocated
    uint256 public totalClaimed;  // Σ rewards ever claimed

    // reentrancy guard — defense-in-depth (contract makes no external calls)
    bool private _claiming;

    // ── events (spec §38) ──
    event ParticipantRegistered(address indexed participant, uint256 registeredAt);
    event ContributionRecorded(
        address indexed participant,
        uint256 indexed roundId,
        bytes32 contributionHash,
        uint256 contributionScore
    );
    event RewardAllocated(address indexed participant, uint256 indexed roundId, uint256 amount);
    event RewardClaimed(address indexed participant, uint256 amount, uint256 claimedAt);
    event RoundFunded(uint256 indexed roundId, uint256 amount);

    // ── custom errors ──
    error NotCoordinator();
    error ZeroAddress();
    error ZeroAmount();
    error AlreadyRegistered(address participant);
    error NotRegistered(address participant);
    error ContributionAlreadyRecorded(address participant, uint256 roundId);
    error NoContributionForRound(address participant, uint256 roundId);
    error RewardAlreadyAllocated(address participant, uint256 roundId);
    error RoundNotFunded(uint256 roundId);
    error InsufficientRoundPool(uint256 requested, uint256 available);
    error NoPendingRewards(address participant);
    error ReentrantCall();

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    constructor() {
        coordinator = msg.sender;
    }

    // ─────────────────────────── coordinator actions ───────────────────────────

    /**
     * @notice Register a participant wallet. Mirrors REGISTER_PARTICIPANT.
     * @param participant wallet address derived by the backend (never a
     *        private key — the platform derives deterministic wallets from
     *        org slugs server-side, see `deriveWalletAddress` in ledger.ts).
     */
    function registerParticipant(address participant) external onlyCoordinator {
        if (participant == address(0)) revert ZeroAddress();
        Participant storage p = participants[participant];
        if (p.registered) revert AlreadyRegistered(participant);
        p.registered = true;
        emit ParticipantRegistered(participant, block.timestamp);
    }

    /**
     * @notice Fund the reward pool of a round (default demo: 1000 DATA = 100000 units).
     */
    function fundRound(uint256 roundId, uint256 amount) external onlyCoordinator {
        if (amount == 0) revert ZeroAmount();
        roundFunded[roundId] += amount;
        totalFunded += amount;
        emit RoundFunded(roundId, amount);
    }

    /**
     * @notice Record a contribution proof. Mirrors RECORD_CONTRIBUTION.
     * @param contributionHash SHA-256 of the privacy-protected model update —
     *        a PROOF only; raw data never goes on-chain (spec §52).
     * @param contributionScore normalized contribution score in 1e6 units
     *        (e.g. 450000 = 0.45). Computed off-chain from real telemetry.
     */
    function recordContribution(
        address participant,
        uint256 roundId,
        bytes32 contributionHash,
        uint256 contributionScore
    ) external onlyCoordinator {
        Participant storage p = participants[participant];
        if (!p.registered) revert NotRegistered(participant);
        RoundContribution storage c = roundContributions[participant][roundId];
        if (c.recorded) revert ContributionAlreadyRecorded(participant, roundId);

        c.recorded = true;
        c.contributionHash = contributionHash;
        c.score = contributionScore;

        p.contributionCount += 1;
        p.lifetimeScore += contributionScore;
        p.lastRoundId = roundId;

        emit ContributionRecorded(participant, roundId, contributionHash, contributionScore);
    }

    /**
     * @notice Allocate DATA rewards to a participant for a round.
     *         Mirrors ALLOCATE_REWARD. Requires a recorded contribution for
     *         that round and enough remaining pool. Rewards become claimable
     *         immediately (pull pattern: the participant calls claimReward()).
     */
    function allocateReward(
        address participant,
        uint256 roundId,
        uint256 amount
    ) external onlyCoordinator {
        if (amount == 0) revert ZeroAmount();
        Participant storage p = participants[participant];
        if (!p.registered) revert NotRegistered(participant);
        if (!roundContributions[participant][roundId].recorded) {
            revert NoContributionForRound(participant, roundId);
        }
        if (roundRewardsAllocated[participant][roundId] != 0) {
            revert RewardAlreadyAllocated(participant, roundId);
        }
        if (roundFunded[roundId] == 0) revert RoundNotFunded(roundId);
        uint256 remaining = roundFunded[roundId] - roundAllocated[roundId];
        if (amount > remaining) revert InsufficientRoundPool(amount, remaining);

        // effects
        roundRewardsAllocated[participant][roundId] = amount;
        roundAllocated[roundId] += amount;
        totalAllocated += amount;
        p.pendingRewards += amount;
        p.totalAllocated += amount;

        emit RewardAllocated(participant, roundId, amount);
    }

    // ─────────────────────────── participant actions ───────────────────────────

    /**
     * @notice Claim all pending rewards (msg.sender). Mirrors CLAIM_REWARD.
     *         Checks-effects-interactions; no external calls → reentrancy-safe.
     */
    function claimReward() external {
        Participant storage p = participants[msg.sender];
        if (!p.registered) revert NotRegistered(msg.sender);
        uint256 amount = p.pendingRewards;
        if (amount == 0) revert NoPendingRewards(msg.sender);
        if (_claiming) revert ReentrantCall();
        _claiming = true;

        // effects (before any potential interaction in future versions)
        p.pendingRewards = 0;
        p.claimedRewards += amount;
        totalClaimed += amount;

        emit RewardClaimed(msg.sender, amount, block.timestamp);

        // interactions: none — DATA is internal accounting, nothing is transferred
        _claiming = false;
    }

    // ─────────────────────────── views (spec §38) ───────────────────────────

    function isParticipant(address participant) external view returns (bool) {
        return participants[participant].registered;
    }

    /**
     * @notice Lifetime contribution summary for a participant.
     * @return lifetimeScore Σ normalized scores (1e6 units)
     * @return contributionCount number of recorded contributions
     * @return lastRoundId last round a contribution was recorded in
     */
    function getParticipantContribution(
        address participant
    ) external view returns (uint256 lifetimeScore, uint256 contributionCount, uint256 lastRoundId) {
        Participant storage p = participants[participant];
        return (p.lifetimeScore, p.contributionCount, p.lastRoundId);
    }

    /**
     * @notice Round contribution proof for a participant (hash + score).
     */
    function getRoundContribution(
        address participant,
        uint256 roundId
    ) external view returns (bytes32 contributionHash, uint256 contributionScore, bool recorded) {
        RoundContribution storage c = roundContributions[participant][roundId];
        return (c.contributionHash, c.score, c.recorded);
    }

    /**
     * @notice Reward allocated to a participant for a specific round (0 = none).
     */
    function getRoundReward(address participant, uint256 roundId) external view returns (uint256 amount) {
        return roundRewardsAllocated[participant][roundId];
    }

    /**
     * @notice Reward wallet state for a participant.
     * @return pending claimable DATA (SCALE units)
     * @return claimed lifetime claimed DATA (SCALE units)
     * @return totalAllocatedTo lifetime allocated DATA (SCALE units)
     */
    function getParticipantRewards(
        address participant
    ) external view returns (uint256 pending, uint256 claimed, uint256 totalAllocatedTo) {
        Participant storage p = participants[participant];
        return (p.pendingRewards, p.claimedRewards, p.totalAllocated);
    }

    /**
     * @notice Total reward pool remaining across all rounds (funded − claimed).
     */
    function totalRewardPool() external view returns (uint256) {
        return totalFunded - totalClaimed;
    }

    /**
     * @notice Reward pool state of one round.
     * @return funded pool funded for the round
     * @return allocated rewards already allocated for the round
     * @return remaining funded − allocated (claimable future allocations)
     */
    function roundRewardPool(uint256 roundId) external view returns (uint256 funded, uint256 allocated, uint256 remaining) {
        return (roundFunded[roundId], roundAllocated[roundId], roundFunded[roundId] - roundAllocated[roundId]);
    }
}
