import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  try {
    console.log("################## Checking accounts.... ##################");
    const [inecChairman, citizen1, citizen2] = await ethers.getSigners();

    console.log("Available accounts ⬇");
    console.table([inecChairman.address, citizen1.address, citizen2.address]);

    // Get current block timestamp
    const currentTime = await time.latest();

    // Set election times - Start in 2 minutes, end in 24 hours
    const startTime = currentTime + 120; // 2 minutes from now
    const endTime = startTime + 86400; // 24 hours after start

    console.log("\nElection Timeline:");
    console.log(
      `Current Time: ${new Date(currentTime * 1000).toLocaleString()}`
    );
    console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()}`);
    console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}\n`);

    // Deploy Election Contract
    console.log(
      "################## Deploying Election Contract.... ##################"
    );
    const Election = await ethers.getContractFactory("Election");
    const election = await Election.deploy(startTime, endTime);
    await election.waitForDeployment();
    const electionAddr = await election.getAddress();

    console.log("Election contract deployed to:", electionAddr);
    console.log("INEC Chairman:", await inecChairman.getAddress());

    console.log(
      "################## Registering Political Parties.... ##################"
    );

    // Register PDP
    const registerPdpTx = await election
      .connect(inecChairman)
      .registerPoliticalParty("People's Democratic Party", "PDP");
    await registerPdpTx.wait();
    console.log("PDP registered successfully!");

    // Register APC
    const registerApcTx = await election
      .connect(inecChairman)
      .registerPoliticalParty("All Progressive Congress", "APC");
    await registerApcTx.wait();
    console.log("APC registered successfully!");

    // Register LP (additional party)
    const registerLpTx = await election
      .connect(inecChairman)
      .registerPoliticalParty("Labour Party", "LP");
    await registerLpTx.wait();
    console.log("LP registered successfully!");

    // List all registered parties
    const allParties = await election.getAllPoliticalParties();
    console.log("\nRegistered Political Parties:");
    console.table(
      allParties.map((party) => ({
        id: party.id.toString(),
        name: party.name,
        abbreviation: party.abbreviation,
      }))
    );

    console.log(
      "################## Registering Citizens.... ##################"
    );

    // Register Citizen 1
    const registerCitizen1Tx = await election
      .connect(citizen1)
      .registerAsCitizen("John Doe");
    await registerCitizen1Tx.wait();
    console.log("Citizen 1 registered successfully!");

    // Register Citizen 2
    const registerCitizen2Tx = await election
      .connect(citizen2)
      .registerAsCitizen("Jane Smith");
    await registerCitizen2Tx.wait();
    console.log("Citizen 2 registered successfully!");

    console.log(
      "################## Registering Candidates.... ##################"
    );

    // Register Candidate 1 (for PDP - Party ID 1)
    const registerCandidate1Tx = await election
      .connect(inecChairman)
      .registerCandidate(1, citizen1.address);
    await registerCandidate1Tx.wait();
    console.log("Candidate 1 registered for PDP!");

    // Register Candidate 2 (for APC - Party ID 2)
    const registerCandidate2Tx = await election
      .connect(inecChairman)
      .registerCandidate(2, citizen2.address);
    await registerCandidate2Tx.wait();
    console.log("Candidate 2 registered for APC!");

    console.log("################## Registering Voters.... ##################");

    // Register Voter 1
    const registerVoter1Tx = await election.connect(citizen1).registerAsVoter();
    await registerVoter1Tx.wait();
    console.log("Voter 1 registered successfully!");

    // Register Voter 2
    const registerVoter2Tx = await election.connect(citizen2).registerAsVoter();
    await registerVoter2Tx.wait();
    console.log("Voter 2 registered successfully!");

    // Start voting
    console.log(
      "################## Starting Voting Process.... ##################"
    );
    console.log("Advancing time to after election start...");

    // Advance time to after election start
    await time.increaseTo(startTime + 60); // 1 minute after start

    // Verify we're in the voting period
    const newTime = await time.latest();
    console.log(
      `Current time after advance: ${new Date(newTime * 1000).toLocaleString()}`
    );

    // Cast votes
    const vote1Tx = await election.connect(citizen1).voteFavoriteCandidate(2);
    await vote1Tx.wait();
    console.log("Citizen 1 voted for Candidate 2 (APC)!");

    const vote2Tx = await election.connect(citizen2).voteFavoriteCandidate(1);
    await vote2Tx.wait();
    console.log("Citizen 2 voted for Candidate 1 (PDP)!");

    // Get voting results
    console.log("################## Voting Results.... ##################");
    const votingScores = await election.getVotingScores();
    console.log("Voting scores:");
    console.table(
      votingScores.map((score) => ({
        name: score.name,
        party: score.partyName + " (" + score.partyAbbreviation + ")",
        votes: score.voteCount.toString(),
      }))
    );

    // Get individual candidate details
    console.log("\nCandidate 1 Details:");
    const candidate1Score = await election.getCandidateScore(1);
    console.log(`Name: ${candidate1Score.name}`);
    console.log(`Party: ${candidate1Score.partyName} (${candidate1Score.partyAbbreviation})`);
    console.log(`Vote Count: ${candidate1Score.voteCount.toString()}`);

    // Get individual candidate details
    console.log("\nCandidate 2 Details:");
    const candidate2Score = await election.getCandidateScore(2);
    console.log(`Name: ${candidate2Score.name}`);
    console.log(`Party: ${candidate2Score.partyName} (${candidate2Score.partyAbbreviation})`);
    console.log(`Vote Count: ${candidate2Score.voteCount.toString()}`);

    // Get citizen details
    console.log("\nCitizen 1 Details:");
    const citizen1Details = await election.getCitizenDetails(citizen1.address);
    console.log(`Name: ${citizen1Details.name}`);
    console.log(`Is Voter: ${citizen1Details.isVoter}`);
    console.log(`Is Candidate: ${citizen1Details.isCandidate}`);
    console.log(`Has Voted: ${citizen1Details.hasVoted}`);
    console.log(`Party: ${citizen1Details.partyName} (${citizen1Details.partyAbbreviation})`);

    const totalVotes = await election.getTotalVotesCast();
    console.log("\nTotal votes cast:", totalVotes.toString());
  } catch (error) {
    console.error("\nError details:", error);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });