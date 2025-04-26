import { ethers } from "hardhat";

async function main() {
  // Current timestamp
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  // election start time (1 day from now)
  const electStart = currentTimestamp + (24 * 60 * 60); // 24 hours from now
  
  // election end time (3 days from start)
  const electEnds = electStart + (3 * 24 * 60 * 60); // 3 days after start
  
  // Deploy with constructor arguments
  const election = await ethers.deployContract("Election", [electStart, electEnds]);
  
  await election.waitForDeployment();
  
  console.log({
    "Election contract successfully deployed to": election.target,
    "Election starts at": new Date(electStart * 1000).toLocaleString(),
    "Election ends at": new Date(electEnds * 1000).toLocaleString()
  });
}

main().catch((error: any) => {
  console.error(error);
  process.exitCode = 1;
});