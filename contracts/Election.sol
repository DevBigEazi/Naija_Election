// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

enum PoliticalParty { NONE, PDP, APC }

error OnlyInecChairman();
error AddressZeroDetected();
error NotRegisteredAsCitizen();
error AlreadyRegistered();
error AlreadyVoted();
error InvalidCandidate();
error InvalidPoliticalParty();
error CitizenNotFound();
error ElectionNotStarted();
error ElectionEnded();

contract Election is ReentrancyGuard {
    address public inecChairman;
    uint public candidateCount;
    uint256 public citizenCount;
    uint256 public votersCount;

    uint256 public electStart;
    uint256 public electEnds;

    struct CitizenDetails {
        uint256 id;
        string name;
        address addr;
        bool voter;
        bool candidate;
        bool citizen;
        bool hasVoted;
        PoliticalParty politicalParty;
    }

    struct CandidateScore {
        address candidateAddress;
        string name;
        PoliticalParty party;
        uint256 voteCount;
    }

    constructor(uint256 _electStart, uint256 _electEnds) {
        require(_electStart > block.timestamp,"Election start date must be in future" );
        require(_electEnds > electStart, "Election end date must be greater than start date");

        electStart = _electStart;
        electEnds = _electEnds;
        inecChairman = msg.sender;
    }

    modifier onlyinecChairman() {
        if (msg.sender != inecChairman) revert OnlyInecChairman();
        _;
    }

    mapping(address => CitizenDetails) public citizens;
    mapping(uint256 => CitizenDetails) public candidates;
    mapping(uint256 => uint256) public candidateVotes;
    
    event CandidateRegistered(address indexed _inecChairman, address indexed _addr);
    event CitizenRegistered(address indexed _citizenAddr, string _name);
    event VoterRegistered(address indexed _voterAddr, string _name);
    event VoteCast(address indexed _voter, uint256 indexed _candidateId);

    function registerAsCitizen(string memory _fullName) external {
        if (msg.sender == address(0)) revert AddressZeroDetected();
        
        // Check if already registered
        if (citizens[msg.sender].citizen) revert AlreadyRegistered();
        
        CitizenDetails storage citizenDetails = citizens[msg.sender];
        citizenDetails.name = _fullName;
        citizenDetails.addr = msg.sender;
        citizenDetails.citizen = true;
        citizenCount += 1;

        emit CitizenRegistered(msg.sender, _fullName);
    }

    function registerCandidate(
        PoliticalParty _politicalParty,
        address _candidateAddr
    ) external onlyinecChairman {
        // Sanity checks
        if (_candidateAddr == address(0)) revert AddressZeroDetected();
        require(candidateCount < 2, "inecChairman is only taking two candidates");
        if (_politicalParty == PoliticalParty.NONE) revert InvalidPoliticalParty();

        CitizenDetails storage citizenCheck = citizens[_candidateAddr];
        if (!citizenCheck.citizen) revert NotRegisteredAsCitizen();
        if (citizenCheck.candidate) revert AlreadyRegistered();

        uint256 candidateId = candidateCount + 1;
        
        CitizenDetails storage citizenDetails = candidates[candidateId];
        citizenDetails.addr = _candidateAddr;
        citizenDetails.name = citizenCheck.name;
        citizenDetails.politicalParty = _politicalParty;
        citizenDetails.candidate = true;
        citizenDetails.voter = true;
        
        // Update the citizen's record
        citizenCheck.candidate = true;
        citizenCheck.politicalParty = _politicalParty;
        
        candidateCount = candidateId;

        emit CandidateRegistered(inecChairman, _candidateAddr);
    }

    function registerAsVoter() external returns (bool) {
        if (msg.sender == address(0)) revert AddressZeroDetected();
        
        // Check if the address is registered as a citizen
        CitizenDetails storage citizenCheck = citizens[msg.sender];
        if (!citizenCheck.citizen) revert NotRegisteredAsCitizen();
        if (citizenCheck.voter) revert AlreadyRegistered();
        
        citizenCheck.voter = true;
        votersCount += 1;

        emit VoterRegistered(msg.sender, citizenCheck.name);
        return true;
    }

    function voteFavoriteCandidate(uint256 _candidateId) external {
        if (_candidateId == 0 || _candidateId > candidateCount) revert InvalidCandidate();
        if (block.timestamp < electStart) revert ElectionNotStarted();
        if (block.timestamp > electEnds) revert ElectionEnded();
        
        CitizenDetails storage voter = citizens[msg.sender];
        
        if (!voter.voter) revert NotRegisteredAsCitizen();
        if (voter.hasVoted) revert AlreadyVoted();
        
        candidateVotes[_candidateId] += 1;
        voter.hasVoted = true;
        
        emit VoteCast(msg.sender, _candidateId);
    }

    function getCitizenDetails(address _citizenAddr) 
        external 
        view 
        returns (
            string memory name,
            bool isVoter,
            bool isCandidate,
            bool isCitizen,
            bool hasVoted,
            PoliticalParty party
        ) 
    {
        if (_citizenAddr == address(0)) revert AddressZeroDetected();
        
        CitizenDetails storage citizen = citizens[_citizenAddr];
        if (!citizen.citizen) revert CitizenNotFound();

        return (
            citizen.name,
            citizen.voter,
            citizen.candidate,
            citizen.citizen,
            citizen.hasVoted,
            citizen.politicalParty
        );
    }

     function getVotingScores() 
        external 
        view 
        returns (CandidateScore[] memory) 
    {
        CandidateScore[] memory scores = new CandidateScore[](candidateCount);
        
        for (uint256 i = 1; i <= candidateCount; i++) {
            CitizenDetails storage candidate = candidates[i];
            scores[i-1] = CandidateScore({
                candidateAddress: candidate.addr,
                name: candidate.name,
                party: candidate.politicalParty,
                voteCount: candidateVotes[i]
            });
        }
        
        return scores;
    }

    function getCandidateScore(uint256 _candidateId) 
        external 
        view 
        returns (CandidateScore memory) 
    {
        if (_candidateId == 0 || _candidateId > candidateCount) revert InvalidCandidate();
        
        CitizenDetails storage candidate = candidates[_candidateId];
        return CandidateScore({
            candidateAddress: candidate.addr,
            name: candidate.name,
            party: candidate.politicalParty,
            voteCount: candidateVotes[_candidateId]
        });
    }

    // Get total votes cast
    function getTotalVotesCast() 
        external 
        view 
        returns (uint256 totalVotes) 
    {
        for (uint256 i = 1; i <= candidateCount; i++) {
            totalVotes += candidateVotes[i];
        }
        return totalVotes;
    }
}