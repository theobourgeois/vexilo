import flagsJson from "@/content/flag.json";
import { Flag } from "./types";

const flags = flagsJson as unknown as Flag[];

export function getRandomFlag() {
	const randomIndex = Math.floor(Math.random() * (flags.length - 1));
	return flags[randomIndex];
}
