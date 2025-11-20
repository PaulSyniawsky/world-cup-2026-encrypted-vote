"use client";

import { useEffect, useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { motion } from "framer-motion";
import { MdEmojiEvents, MdFlag, MdOutlineDoneAll, MdOutlineNavigateNext, MdOutlineSportsSoccer } from "react-icons/md";
import ClipLoader from "react-spinners/ClipLoader";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEWorldCupHook } from "~~/hooks/useFHEWorldCupHook";

type Team = { id: number; name: string; flag: string };

// 16 teams
const TEAMS: Team[] = [
  { id: 1, name: "Brazil", flag: "/brazil.png" },
  { id: 2, name: "Argentina", flag: "/argentina.png" },
  { id: 3, name: "Germany", flag: "/germany.png" },
  { id: 4, name: "France", flag: "/france.png" },
  { id: 5, name: "Spain", flag: "/spain.png" },
  { id: 6, name: "Italy", flag: "/italy.png" },
  { id: 7, name: "Netherlands", flag: "/netherlands.png" },
  { id: 8, name: "Belgium", flag: "/belgium.png" },
  { id: 9, name: "Portugal", flag: "/portugal.png" },
  { id: 10, name: "England", flag: "/england.png" },
  { id: 11, name: "Croatia", flag: "/croatia.png" },
  { id: 12, name: "Uruguay", flag: "/uruguay.png" },
  { id: 13, name: "Mexico", flag: "/mexico.png" },
  { id: 14, name: "USA", flag: "/usa.png" },
  { id: 15, name: "Japan", flag: "/japan.png" },
  { id: 16, name: "South Korea", flag: "/southkorea.png" },
];

const chunkTeams = (teams: Team[], size: number): Team[][] => {
  const chunks: Team[][] = [];
  for (let i = 0; i < teams.length; i += size) chunks.push(teams.slice(i, i + size));
  return chunks;
};

const getMatchTime = (index: number, round: number) => {
  const baseDay = round === 1 ? 22 : round === 2 ? 25 : round === 3 ? 28 : 1;
  const day = baseDay + Math.floor(index / 2);
  const hour = index % 2 === 0 ? 19 + index * 0.3 : 22 + index * 0.2;
  return `Sat, Nov ${day} ${Math.floor(hour)}:30`;
};

// --- Packing & Unpacking journey into 32-bit ---
const packJourney = (rounds: number[][], allRoundsTeams: Team[][][]) => {
  let num = 0;
  let bitPos = 0;

  rounds.forEach((round, rIdx) => {
    const pairs = allRoundsTeams[rIdx]; // pairs of teams for this round
    pairs.forEach(pair => {
      const winnerId = round.find(id => pair.some(t => t.id === id));
      if (!winnerId) throw new Error("Invalid winner selection");
      const rightTeamId = pair[1].id;
      const bit = winnerId === rightTeamId ? 1 : 0;
      num |= bit << bitPos;
      bitPos++;
    });
  });

  return num;
};

const unpackJourney = (num: number, allRoundsTeams: Team[][][]): number[][] => {
  const rounds: number[][] = [];
  let bitPos = 0;

  allRoundsTeams.forEach(pairs => {
    const winners: number[] = [];
    pairs.forEach(pair => {
      const winner = ((num >> bitPos) & 1) === 0 ? pair[0].id : pair[1].id;
      winners.push(winner);
      bitPos++;
    });
    rounds.push(winners);
  });

  return rounds;
};

export const FHEWorldCup = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);
  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };
  const { instance: fhevmInstance } = useFhevm({ provider, chainId, initialMockChains, enabled: true });
  const worldCup = useFHEWorldCupHook({ instance: fhevmInstance, initialChains: initialMockChains });

  const [currentRound, setCurrentRound] = useState(1);
  const [roundTeams, setRoundTeams] = useState<Team[][]>(chunkTeams(TEAMS, 2));
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [journey, setJourney] = useState<number[][]>([]);
  const [loadedFromContract, setLoadedFromContract] = useState(false);

  const allRoundsPairs = useMemo(() => {
    const rounds: Team[][][] = [];
    let teams = [...TEAMS];
    for (let r = 1; r <= 4; r++) {
      const pairs = chunkTeams(teams, 2);
      rounds.push(pairs);
      teams = pairs.map(pair => pair[0]); // placeholder, overwritten by actual winners
    }
    return rounds;
  }, []);

  useEffect(() => {
    if (worldCup.decrypted && !loadedFromContract && worldCup.clear) {
      const packedNumber = parseInt(worldCup.clear as string, 10);
      const rounds = unpackJourney(packedNumber, allRoundsPairs);
      setJourney(rounds);
      setLoadedFromContract(true);

      // update roundTeams & selectedTeams for UI
      const currentPairs = chunkTeams(TEAMS, 2);
      setRoundTeams(currentPairs);
    }
  }, [worldCup.decrypted, worldCup.clear, loadedFromContract, allRoundsPairs]);

  const getSelectedTeamInPair = (pair: Team[]): number | null =>
    pair.find(team => selectedTeams.includes(team.id))?.id ?? null;

  const handleSelectTeam = (teamId: number, pair: Team[]) => {
    setSelectedTeams(prev => {
      const currentSelection = pair.find(t => prev.includes(t.id))?.id;
      if (currentSelection === teamId) return prev.filter(id => id !== teamId);
      if (currentSelection) return [...prev.filter(id => id !== currentSelection), teamId];
      return [...prev, teamId];
    });
  };

  const advanceRound = async () => {
    const newJourney = [...journey, selectedTeams];
    setJourney(newJourney);

    if (currentRound < 4) {
      const winners = TEAMS.filter(t => selectedTeams.includes(t.id));
      setRoundTeams(chunkTeams(winners, 2));
      setSelectedTeams([]);
      setCurrentRound(currentRound + 1);
    } else if (worldCup.readyToVote) {
      // --- submit packed journey
      const packedNumber = packJourney(newJourney, allRoundsPairs);
      await worldCup.submitPrediction(packedNumber.toString());
    }
  };

  if (!isConnected)
    return (
      <div className="min-h-[calc(100vh-60px)] w-full flex items-center justify-center bg-[#0f0f17]">
        <div className="bg-[#1c1f2b] border border-[#2a2f3a] shadow-2xl rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-3 text-white">Wallet Not Connected</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to participate.</p>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    );

  const matchesCol1 = roundTeams.filter((_, i) => i % 2 === 0);
  const matchesCol2 = roundTeams.filter((_, i) => i % 2 !== 0);

  const getRoundName = (round: number) => {
    switch (round) {
      case 1:
        return "Round of 16";
      case 2:
        return "Quarter-Finals";
      case 3:
        return "Semi-Finals";
      case 4:
        return "Final";
      default:
        return `Round ${round}`;
    }
  };

  const isNextDisabled = selectedTeams.length !== roundTeams.length || worldCup.loading || worldCup.alreadyVoted;

  const renderFinalMatch = () => {
    const [teamA, teamB] = roundTeams[0];
    const championId = journey[3]?.[0];
    const champion = TEAMS.find(t => t.id === championId);

    return (
      <div className="flex items-center justify-center gap-10 bg-[#1c1f2b] p-6 rounded-3xl shadow-2xl border border-[#2a2f3a]">
        <TeamCard
          team={teamA}
          selected={selectedTeams.includes(teamA.id)}
          onSelect={() => handleSelectTeam(teamA.id, roundTeams[0])}
        />
        {champion && (
          <div className="flex flex-col items-center">
            <MdEmojiEvents className="text-yellow-400 w-12 h-12 mb-2" />
            <span className="text-xl font-bold text-yellow-400">{champion.name}</span>
          </div>
        )}
        <TeamCard
          team={teamB}
          selected={selectedTeams.includes(teamB.id)}
          onSelect={() => handleSelectTeam(teamB.id, roundTeams[0])}
        />
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-60px)] w-full mx-auto p-6 space-y-8 text-white font-sans">
      {worldCup.loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
          <ClipLoader color="#38e8b8" size={50} />
        </div>
      )}

      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center bg-[#1c1f2b] p-6 rounded-3xl shadow-xl border border-[#2a2f3a]"
      >
        <h1 className="text-4xl font-extrabold mb-1 flex items-center justify-center text-white">
          <MdOutlineSportsSoccer className="text-pink-500 mr-3 w-8 h-8" /> FHE World Cup 2026 Voting
        </h1>
        <p className="text-2xl font-bold text-emerald-400 mb-2">{getRoundName(currentRound)}</p>
        <p className="text-md text-gray-400">Select the winner. Your data remains fully encrypted!</p>
      </motion.div>

      {currentRound === 4 ? (
        renderFinalMatch()
      ) : (
        <div className="bg-[#1c1f2b] p-6 rounded-3xl shadow-2xl border border-[#2a2f3a]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:border-r md:pr-6 border-[#2a2f3a]">
              {matchesCol1.map((pair, i) => (
                <MatchupCard
                  key={`col1-${i}`}
                  pair={pair}
                  index={i * 2}
                  round={currentRound}
                  selectedTeamId={getSelectedTeamInPair(pair)}
                  onSelectTeam={teamId => handleSelectTeam(teamId, pair)}
                />
              ))}
            </div>
            <div className="space-y-4 md:pl-6">
              {matchesCol2.map((pair, i) => (
                <MatchupCard
                  key={`col2-${i}`}
                  pair={pair}
                  index={i * 2 + 1}
                  round={currentRound}
                  selectedTeamId={getSelectedTeamInPair(pair)}
                  onSelectTeam={teamId => handleSelectTeam(teamId, pair)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {!worldCup.alreadyVoted && (
        <div className="flex justify-center pt-4">
          <motion.button
            onClick={advanceRound}
            disabled={isNextDisabled}
            whileHover={{ scale: isNextDisabled ? 1 : 1.05 }}
            whileTap={{ scale: isNextDisabled ? 1 : 0.98 }}
            className={`flex items-center px-10 py-4 text-white font-extrabold text-xl rounded-full shadow-2xl transition duration-300 ${
              isNextDisabled
                ? "bg-gray-700 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-emerald-400/50"
            }`}
          >
            {currentRound < 4 ? (
              <>
                Next Round <MdOutlineNavigateNext className="ml-3 w-7 h-7" />
              </>
            ) : (
              <>
                Submit Champion <MdEmojiEvents className="ml-3 w-7 h-7" />
              </>
            )}
          </motion.button>
        </div>
      )}

      {journey.length > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-[#1c1f2b] p-6 rounded-3xl shadow-2xl border border-[#2a2f3a]"
        >
          <h3 className="text-2xl font-bold mb-4 border-b-2 border-purple-500 pb-2 text-white flex items-center">
            <MdFlag className="mr-2 text-purple-400" /> 🏆 Your Prediction Journey
          </h3>
          <div className="space-y-4">
            {journey.map((round, idx) => (
              <div key={idx} className="p-4 bg-[#2a2f3a] rounded-xl shadow-inner border border-[#3a4150]">
                <p className="font-extrabold text-lg mb-2 text-yellow-400">{getRoundName(idx + 1)}</p>
                <div className="flex flex-wrap gap-3">
                  {round.map(teamId => {
                    const t = TEAMS.find(x => x.id === teamId)!;
                    return (
                      <motion.div
                        key={teamId}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center space-x-2 bg-[#0f1118] p-2 rounded-full shadow-md border border-emerald-500/50 transition duration-200"
                      >
                        <img src={t.flag} alt={t.name} className="w-7 h-7 rounded-full border-2 border-gray-500" />
                        <span className="text-sm font-semibold text-gray-200">{t.name}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {worldCup.statusMsg && (
        <div className="bg-yellow-900/50 text-yellow-300 p-4 rounded-xl shadow-md border border-yellow-800 font-medium">
          <p>⚠️ {worldCup.statusMsg}</p>
        </div>
      )}

      {worldCup.alreadyVoted && !worldCup.decrypted && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => worldCup.decryptMyPrediction()}
            className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg"
          >
            Decrypt Journey
          </button>
        </div>
      )}
    </div>
  );
};

// --- Components ---
const MatchupCard = ({ pair, index, round, selectedTeamId, onSelectTeam }: any) => {
  const [teamA, teamB] = pair;

  const renderTeam = (team: Team) => {
    const isSelected = selectedTeamId === team.id;
    const teamClassName = `flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
      isSelected
        ? "bg-emerald-700/30 text-emerald-300 font-extrabold border-2 border-emerald-500 shadow-xl"
        : "bg-[#2a2f3a] text-gray-100 hover:bg-[#343b46] border border-[#3a4150] shadow-md"
    }`;
    return (
      <motion.div
        whileHover={{ scale: isSelected ? 1.01 : 1.03 }}
        whileTap={{ scale: isSelected ? 0.99 : 0.97 }}
        onClick={() => onSelectTeam(team.id)}
        className={teamClassName}
      >
        <img src={team.flag} alt={team.name} className="w-8 h-8 mr-3 rounded-full border-2 border-gray-500" />
        <span className="font-semibold text-base">{team.name}</span>
        {isSelected && <MdOutlineDoneAll className="ml-auto text-green-400 w-6 h-6" />}
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="grid grid-cols-[4fr_1fr] rounded-xl overflow-hidden shadow-2xl border border-[#2a2f3a] bg-[#1c1f2b]"
    >
      <div className="p-3 space-y-2">
        {renderTeam(teamA)} {renderTeam(teamB)}
      </div>
      <div className="flex items-center justify-center bg-purple-700/20 text-center text-sm font-bold text-purple-300 border-l-2 border-purple-500 p-2">
        <p className="leading-snug">{getMatchTime(index, round)}</p>
      </div>
    </motion.div>
  );
};

const TeamCard = ({ team, selected, onSelect }: { team: Team; selected: boolean; onSelect: () => void }) => (
  <div
    onClick={onSelect}
    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
      selected
        ? "bg-emerald-700/30 text-emerald-300 font-extrabold border-2 border-emerald-500 shadow-xl"
        : "bg-[#2a2f3a] text-gray-100 hover:bg-[#343b46] border border-[#3a4150] shadow-md"
    }`}
  >
    <img src={team.flag} alt={team.name} className="w-10 h-10 mr-3 rounded-full border-2 border-gray-500" />
    <span className="font-semibold text-lg">{team.name}</span>
  </div>
);
