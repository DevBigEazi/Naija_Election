// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
error PartyAlreadyExists();
error PartyDoesNotExist();

contract Election {
    address public inecChairman;
    uint public candidateCount;
    uint256 public citizenCount;
    uint256 public votersCount;
    uint256 public partyCount;

    uint256 public electStart;
    uint256 public electEnds;

    struct PoliticalParty {
        uint256 id;
        string name;
        string abbreviation;
        bool exists;
    }

    struct CitizenDetails {
        uint256 id;
        string name;
        address addr;
        bool voter;
        bool candidate;
        bool citizen;
        bool hasVoted;
        uint256 politicalPartyId; // 0 means no party
    }

    struct CandidateScore {
        address candidateAddress;
        string name;
        string partyName;
        string partyAbbreviation;
        uint256 voteCount;
    }

    constructor(uint256 _electStart, uint256 _electEnds) {
        require(_electStart > block.timestamp,"Election start date must be in future" );
        require(_electEnds > _electStart, "Election end date must be greater than start date");

        electStart = _electStart;
        electEnds = _electEnds;
        inecChairman = msg.sender;
        partyCount = 0;
    }

    modifier onlyInecChairman() {
        if (msg.sender != inecChairman) revert OnlyInecChairman();
        _;
    }

    mapping(address => CitizenDetails) public citizens;
    mapping(uint256 => CitizenDetails) public candidates;
    mapping(uint256 => uint256) public candidateVotes;
    mapping(uint256 => PoliticalParty) public politicalParties;
    mapping(string => bool) public partyAbbreviationExists;
    mapping(string => bool) public partyNameExists;
    
    event CandidateRegistered(address indexed _inecChairman, address indexed _addr);
    event CitizenRegistered(address indexed _citizenAddr, string _name);
    event VoterRegistered(address indexed _voterAddr, string _name);
    event VoteCast(address indexed _voter, uint256 indexed _candidateId);
    event PoliticalPartyRegistered(uint256 indexed _partyId, string _name, string _abbreviation);

    function registerPoliticalParty(string memory _name, string memory _abbreviation) external onlyInecChairman {
        if (bytes(_name).length == 0 || bytes(_abbreviation).length == 0) revert InvalidPoliticalParty();
        if (partyNameExists[_name]) revert PartyAlreadyExists();
        if (partyAbbreviationExists[_abbreviation]) revert PartyAlreadyExists();
        
        uint256 partyId = partyCount + 1;
        
        PoliticalParty storage newParty = politicalParties[partyId];
        newParty.id = partyId;
        newParty.name = _name;
        newParty.abbreviation = _abbreviation;
        newParty.exists = true;
        
        partyNameExists[_name] = true;
        partyAbbreviationExists[_abbreviation] = true;
        partyCount = partyId;
        
        emit PoliticalPartyRegistered(partyId, _name, _abbreviation);
    }

    function getPartyDetails(uint256 _partyId) external view returns (string memory name, string memory abbreviation) {
        if (_partyId == 0 || _partyId > partyCount) revert InvalidPoliticalParty();
        if (!politicalParties[_partyId].exists) revert PartyDoesNotExist();
        
        PoliticalParty storage party = politicalParties[_partyId];
        return (party.name, party.abbreviation);
    }

    function registerAsCitizen(string memory _fullName) external {
        if (msg.sender == address(0)) revert AddressZeroDetected();
        
        // Check if already registered
        if (citizens[msg.sender].citizen) revert AlreadyRegistered();
        
        CitizenDetails storage citizenDetails = citizens[msg.sender];
        citizenDetails.name = _fullName;
        citizenDetails.addr = msg.sender;
        citizenDetails.citizen = true;
        citizenDetails.politicalPartyId = 0; // No party by default
        citizenCount += 1;

        emit CitizenRegistered(msg.sender, _fullName);
    }

    function registerCandidate(
        uint256 _politicalPartyId,
        address _candidateAddr
    ) external onlyInecChairman {
        // Sanity checks
        if (_candidateAddr == address(0)) revert AddressZeroDetected();
        require(candidateCount < 2, "inecChairman is only taking two candidates");
        if (_politicalPartyId == 0 || _politicalPartyId > partyCount) revert InvalidPoliticalParty();
        if (!politicalParties[_politicalPartyId].exists) revert PartyDoesNotExist();

        CitizenDetails storage citizenCheck = citizens[_candidateAddr];
        if (!citizenCheck.citizen) revert NotRegisteredAsCitizen();
        if (citizenCheck.candidate) revert AlreadyRegistered();

        uint256 candidateId = candidateCount + 1;
        
        CitizenDetails storage citizenDetails = candidates[candidateId];
        citizenDetails.addr = _candidateAddr;
        citizenDetails.name = citizenCheck.name;
        citizenDetails.politicalPartyId = _politicalPartyId;
        citizenDetails.candidate = true;
        citizenDetails.voter = true;
        
        // Update the citizen's record
        citizenCheck.candidate = true;
        citizenCheck.politicalPartyId = _politicalPartyId;
        
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
            uint256 politicalPartyId,
            string memory partyName,
            string memory partyAbbreviation
        ) 
    {
        if (_citizenAddr == address(0)) revert AddressZeroDetected();
        
        CitizenDetails storage citizen = citizens[_citizenAddr];
        if (!citizen.citizen) revert CitizenNotFound();

        string memory _partyName = "";
        string memory _partyAbbreviation = "";
        
        if (citizen.politicalPartyId > 0 && politicalParties[citizen.politicalPartyId].exists) {
            _partyName = politicalParties[citizen.politicalPartyId].name;
            _partyAbbreviation = politicalParties[citizen.politicalPartyId].abbreviation;
        }

        return (
            citizen.name,
            citizen.voter,
            citizen.candidate,
            citizen.citizen,
            citizen.hasVoted,
            citizen.politicalPartyId,
            _partyName,
            _partyAbbreviation
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
            string memory partyName = "";
            string memory partyAbbreviation = "";
            
            if (candidate.politicalPartyId > 0 && politicalParties[candidate.politicalPartyId].exists) {
                partyName = politicalParties[candidate.politicalPartyId].name;
                partyAbbreviation = politicalParties[candidate.politicalPartyId].abbreviation;
            }
            
            scores[i-1] = CandidateScore({
                candidateAddress: candidate.addr,
                name: candidate.name,
                partyName: partyName,
                partyAbbreviation: partyAbbreviation,
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
        string memory partyName = "";
        string memory partyAbbreviation = "";
        
        if (candidate.politicalPartyId > 0 && politicalParties[candidate.politicalPartyId].exists) {
            partyName = politicalParties[candidate.politicalPartyId].name;
            partyAbbreviation = politicalParties[candidate.politicalPartyId].abbreviation;
        }
        
        return CandidateScore({
            candidateAddress: candidate.addr,
            name: candidate.name,
            partyName: partyName,
            partyAbbreviation: partyAbbreviation,
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

    // Get all registered political parties
    function getAllPoliticalParties() 
        external 
        view 
        returns (PoliticalParty[] memory) 
    {
        PoliticalParty[] memory parties = new PoliticalParty[](partyCount);
        
        for (uint256 i = 1; i <= partyCount; i++) {
            parties[i-1] = politicalParties[i];
        }
        
        return parties;
    }
}