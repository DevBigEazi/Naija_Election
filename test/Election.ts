import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Election", () => {
  const deployElectionContract = async () => {
    const [inecChairman, citizen1, citizen2, citizen3, citizen4] =
      await hre.ethers.getSigners();

    console.log(inecChairman.address);

      // Current timestamp
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  // election start time (1 day from now)
  const electStart = currentTimestamp + (24 * 60 * 60); // 24 hours from now
  
  // election end time (3 days from start)
  const electEnds = electStart + (3 * 24 * 60 * 60); // 3 days after start

    const Election = await hre.ethers.getContractFactory("Election");

    const deployElection = await Election.deploy(electStart, electEnds);

    // Register political parties by default for testing
    await deployElection
      .connect(inecChairman)
      .registerPoliticalParty("People's Democratic Party", "PDP");
    await deployElection
      .connect(inecChairman)
      .registerPoliticalParty("All Progressive Congress", "APC");

    return {
      deployElection,
      inecChairman,
      citizen1,
      citizen2,
      citizen3,
      citizen4,
      electStart,
      electEnds,
    };
  };

  describe("Deployment", () => {
    it("Should set the right INEC chairman", async () => {
      const { deployElection, inecChairman } = await loadFixture(
        deployElectionContract
      );

      expect(await deployElection.inecChairman()).to.equal(
        inecChairman.address
      );
    });

    it("Should set the correct election time period", async () => {
      const { deployElection, electStart, electEnds } = await loadFixture(
        deployElectionContract
      );

      expect(await time.latest())
        .to.be.lessThan(electStart)
        .to.be.revertedWith("Election start date must be in future");
      expect(electStart)
        .to.be.lessThan(electEnds)
        .to.be.revertedWith("Election end date must be greater");
    });
  });

  describe("Political Party Registration", () => {
    it("Should register new political parties", async () => {
      const { deployElection, inecChairman } = await loadFixture(
        deployElectionContract
      );

      // Register a new party
      await expect(
        deployElection
          .connect(inecChairman)
          .registerPoliticalParty("New Nigeria People's Party", "NNPP")
      )
        .to.emit(deployElection, "PoliticalPartyRegistered")
        .withArgs(3, "New Nigeria People's Party", "NNPP");

      // Check if party was registered
      const partyDetails = await deployElection.getPartyDetails(3);
      expect(partyDetails.name).to.equal("New Nigeria People's Party");
      expect(partyDetails.abbreviation).to.equal("NNPP");
    });

    it("Should not allow non-chairman to register parties", async () => {
      const { deployElection, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await expect(
        deployElection
          .connect(citizen1)
          .registerPoliticalParty("Labour Party", "LP")
      ).to.be.revertedWithCustomError(deployElection, "OnlyInecChairman");
    });

    it("Should not register a party with existing name or abbreviation", async () => {
      const { deployElection, inecChairman } = await loadFixture(
        deployElectionContract
      );

      // Try to register with existing abbreviation
      await expect(
        deployElection
          .connect(inecChairman)
          .registerPoliticalParty("New Party", "PDP")
      ).to.be.revertedWithCustomError(deployElection, "PartyAlreadyExists");

      // Try to register with existing name
      await expect(
        deployElection
          .connect(inecChairman)
          .registerPoliticalParty("People's Democratic Party", "XYZ")
      ).to.be.revertedWithCustomError(deployElection, "PartyAlreadyExists");
    });
  });

  describe("Citizen Registration", () => {
    it("Should register a new citizen", async () => {
      const { deployElection, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await expect(
        deployElection.connect(citizen1).registerAsCitizen("John Doe")
      )
        .to.emit(deployElection, "CitizenRegistered")
        .withArgs(citizen1.address, "John Doe");

      const citizenDetails = await deployElection.getCitizenDetails(
        citizen1.address
      );
      expect(citizenDetails.name).to.equal("John Doe");
      expect(citizenDetails.isCitizen).to.be.true;
      expect(citizenDetails.politicalPartyId).to.equal(0); // No party by default
    });

    it("Should not register same citizen twice", async () => {
      const { deployElection, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await expect(
        deployElection.connect(citizen1).registerAsCitizen("John Doe")
      ).to.be.revertedWithCustomError(deployElection, "AlreadyRegistered");
    });
  });

  describe("Candidate Registration", () => {
    it("Should register a candidate", async () => {
      const { deployElection, inecChairman, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await deployElection.connect(citizen1).registerAsCitizen("John Doe");

      await expect(
        deployElection
          .connect(inecChairman)
          .registerCandidate(1, citizen1.address)
      )
        .to.emit(deployElection, "CandidateRegistered")
        .withArgs(inecChairman.address, citizen1.address);

      const candidateDetails = await deployElection.getCitizenDetails(
        citizen1.address
      );
      expect(candidateDetails.isCandidate).to.be.true;
      expect(candidateDetails.politicalPartyId).to.equal(1); // PDP party ID
      expect(candidateDetails.partyName).to.equal("People's Democratic Party");
      expect(candidateDetails.partyAbbreviation).to.equal("PDP");
    });

    it("Should only allow INEC chairman to register candidates", async () => {
      const { deployElection, citizen1, citizen2 } = await loadFixture(
        deployElectionContract
      );

      await deployElection.connect(citizen1).registerAsCitizen("John Doe");

      await expect(
        deployElection.connect(citizen2).registerCandidate(1, citizen1.address)
      ).to.be.revertedWithCustomError(deployElection, "OnlyInecChairman");
    });

    it("Should not register unregistered citizens as candidates", async () => {
      const { deployElection, inecChairman, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await expect(
        deployElection
          .connect(inecChairman)
          .registerCandidate(1, citizen1.address)
      ).to.be.revertedWithCustomError(deployElection, "NotRegisteredAsCitizen");
    });

    it("Should not register a candidate with invalid party ID", async () => {
      const { deployElection, inecChairman, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await deployElection.connect(citizen1).registerAsCitizen("John Doe");

      await expect(
        deployElection
          .connect(inecChairman)
          .registerCandidate(999, citizen1.address) // Invalid party ID
      ).to.be.revertedWithCustomError(deployElection, "InvalidPoliticalParty");
    });
  });

  describe("Voter Registration", () => {
    it("Should register a voter", async () => {
      const { deployElection, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await deployElection.connect(citizen1).registerAsCitizen("John Doe");

      await expect(deployElection.connect(citizen1).registerAsVoter())
        .to.emit(deployElection, "VoterRegistered")
        .withArgs(citizen1.address, "John Doe");

      const voterDetails = await deployElection.getCitizenDetails(
        citizen1.address
      );
      expect(voterDetails.isVoter).to.be.true;
    });

    it("Should not register unregistered citizens as voters", async () => {
      const { deployElection, citizen1 } = await loadFixture(
        deployElectionContract
      );

      await expect(
        deployElection.connect(citizen1).registerAsVoter()
      ).to.be.revertedWithCustomError(deployElection, "NotRegisteredAsCitizen");
    });
  });

  describe("Voting Process", () => {
    it("Should allow voting during election period", async () => {
      const { deployElection, inecChairman, citizen1, citizen2, electStart } =
        await loadFixture(deployElectionContract);

      // Register citizens
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("Jane Smith");

      // Register candidates
      await deployElection
        .connect(inecChairman)
        .registerCandidate(1, citizen1.address);
      await deployElection
        .connect(inecChairman)
        .registerCandidate(2, citizen2.address);

      // Register voters
      await deployElection.connect(citizen1).registerAsVoter();
      await deployElection.connect(citizen2).registerAsVoter();

      // Move time to election period
      await time.increaseTo(electStart + 1);

      // Vote
      await expect(deployElection.connect(citizen1).voteFavoriteCandidate(2))
        .to.emit(deployElection, "VoteCast")
        .withArgs(citizen1.address, 2);

      const candidateScore = await deployElection.getCandidateScore(2);
      expect(candidateScore.voteCount).to.equal(1);
    });

    it("Should not allow voting before election starts", async () => {
      const { deployElection, inecChairman, citizen1, citizen2 } =
        await loadFixture(deployElectionContract);

      // Setup
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("Jane Smith");
      await deployElection.connect(citizen1).registerAsVoter();

      await deployElection
        .connect(inecChairman)
        .registerCandidate(1, citizen2.address);

      // Try voting before start time
      await expect(
        deployElection.connect(citizen1).voteFavoriteCandidate(1)
      ).to.be.revertedWithCustomError(deployElection, "ElectionNotStarted");
    });

    it("Should not allow voting after election ends", async () => {
      const { deployElection, inecChairman, citizen1, citizen2, electEnds } =
        await loadFixture(deployElectionContract);

      // Setup
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("Jane Smith");
      await deployElection.connect(citizen1).registerAsVoter();

      await deployElection
        .connect(inecChairman)
        .registerCandidate(1, citizen2.address);

      // Move time past end time
      await time.increaseTo(electEnds + 1);

      // Try voting after end time
      await expect(
        deployElection.connect(citizen1).voteFavoriteCandidate(1)
      ).to.be.revertedWithCustomError(deployElection, "ElectionEnded");
    });
  });

  describe("Election Results", () => {
    it("Should correctly track voting scores", async () => {
      const { deployElection, inecChairman, citizen1, citizen2, electStart } =
        await loadFixture(deployElectionContract);

      // Setup election
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("Jane Smith");

      await deployElection
        .connect(inecChairman)
        .registerCandidate(1, citizen1.address);
      await deployElection
        .connect(inecChairman)
        .registerCandidate(2, citizen2.address);

      await deployElection.connect(citizen1).registerAsVoter();
      await deployElection.connect(citizen2).registerAsVoter();

      await time.increaseTo(electStart + 1);

      // Cast votes
      await deployElection.connect(citizen1).voteFavoriteCandidate(2);
      await deployElection.connect(citizen2).voteFavoriteCandidate(2);

      // Check results
      const scores = await deployElection.getVotingScores();
      expect(scores[1].voteCount).to.equal(2); // Candidate 2 should have 2 votes
      expect(scores[0].voteCount).to.equal(0); // Candidate 1 should have 0 votes

      const totalVotes = await deployElection.getTotalVotesCast();
      expect(totalVotes).to.equal(2);
    });

    it("Should display correct party information in results", async () => {
      const { deployElection, inecChairman, citizen1, citizen2, electStart } =
        await loadFixture(deployElectionContract);

      // Setup election
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("Jane Smith");

      await deployElection
        .connect(inecChairman)
        .registerCandidate(1, citizen1.address); // PDP
      await deployElection
        .connect(inecChairman)
        .registerCandidate(2, citizen2.address); // APC

      await deployElection.connect(citizen1).registerAsVoter();
      await deployElection.connect(citizen2).registerAsVoter();

      await time.increaseTo(electStart + 1);

      // Cast votes
      await deployElection.connect(citizen1).voteFavoriteCandidate(2);
      await deployElection.connect(citizen2).voteFavoriteCandidate(1);

      // Check results
      const scores = await deployElection.getVotingScores();
      expect(scores[0].partyName).to.equal("People's Democratic Party");
      expect(scores[0].partyAbbreviation).to.equal("PDP");
      expect(scores[1].partyName).to.equal("All Progressive Congress");
      expect(scores[1].partyAbbreviation).to.equal("APC");
    });
  });

  describe("Political Party Listing", () => {
    it("Should list all registered political parties", async () => {
      const { deployElection, inecChairman } = await loadFixture(
        deployElectionContract
      );

      // Register another party
      await deployElection
        .connect(inecChairman)
        .registerPoliticalParty("Labour Party", "LP");

      // Get all parties
      const parties = await deployElection.getAllPoliticalParties();

      expect(parties.length).to.equal(3);
      expect(parties[0].name).to.equal("People's Democratic Party");
      expect(parties[0].abbreviation).to.equal("PDP");
      expect(parties[1].name).to.equal("All Progressive Congress");
      expect(parties[1].abbreviation).to.equal("APC");
      expect(parties[2].name).to.equal("Labour Party");
      expect(parties[2].abbreviation).to.equal("LP");
    });
  });
});
