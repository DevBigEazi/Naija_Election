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

    const Election = await hre.ethers.getContractFactory("Election");
    const startTime = (await time.latest()) + 60; // Start in 1 minute
    const endTime = startTime + 86400; // End in 24 hours
    const deployElection = await Election.deploy(startTime, endTime);

    return {
      deployElection,
      inecChairman,
      citizen1,
      citizen2,
      citizen3,
      citizen4,
      startTime,
      endTime,
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
      const { deployElection, startTime, endTime } = await loadFixture(
        deployElectionContract
      );

      expect(await time.latest())
        .to.be.lessThan(startTime)
        .to.be.revertedWith("Election start date must be in future");
      expect(startTime)
        .to.be.lessThan(endTime)
        .to.be.revertedWith("Election end date must be greater");
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
      expect(candidateDetails.party).to.equal(1); // PDP
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
      const { deployElection, inecChairman, citizen1, citizen2, startTime } =
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
      await time.increaseTo(startTime + 1);

      // Vote
      await expect(deployElection.connect(citizen1).voteFavoriteCandidate(2))
        .to.emit(deployElection, "VoteCast")
        .withArgs(citizen1.address, 2);

      const candidateScore = await deployElection.getCandidateScore(2);
      expect(candidateScore.voteCount).to.equal(1);
    });

    it("Should not allow voting before election starts", async () => {
      const { deployElection, citizen1, citizen2 } = await loadFixture(
        deployElectionContract
      );

      // Setup
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("John Egbeda");
      await deployElection.connect(citizen1).registerAsVoter();

      await deployElection.registerCandidate(1, citizen2);

      // Try voting before start time
      await expect(
        deployElection.connect(citizen1).voteFavoriteCandidate(1)
      ).to.be.revertedWithCustomError(deployElection, "ElectionNotStarted");
    });

    it("Should not allow voting after election ends", async () => {
      const { deployElection, citizen1, citizen2, endTime } = await loadFixture(
        deployElectionContract
      );

      // Setup
      await deployElection.connect(citizen1).registerAsCitizen("John Doe");
      await deployElection.connect(citizen2).registerAsCitizen("John Egbeda");
      await deployElection.connect(citizen1).registerAsVoter();

      await deployElection.registerCandidate(1, citizen2);

      // Move time past end time
      await time.increaseTo(endTime + 1);

      // Try voting after end time
      await expect(
        deployElection.connect(citizen1).voteFavoriteCandidate(1)
      ).to.be.revertedWithCustomError(deployElection, "ElectionEnded");
    });
  });

  describe("Election Results", () => {
    it("Should correctly track voting scores", async () => {
      const { deployElection, inecChairman, citizen1, citizen2, startTime } =
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

      await time.increaseTo(startTime + 1);

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
  });
});
