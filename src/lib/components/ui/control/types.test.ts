import { describe, expect, it } from "vitest";
import { filterGroups, nextIndex } from "./types";

describe("le frecce spostano la scelta dentro un gruppo di opzioni", () => {
	it.each([
		[0, "ArrowRight", 3, 1],
		[2, "ArrowRight", 3, 0],
		[0, "ArrowLeft", 3, 2],
		[1, "ArrowUp", 3, 0],
		[-1, "ArrowDown", 3, 0],
		[-1, "ArrowUp", 3, 2],
		[1, "Home", 3, 0],
		[0, "End", 3, 2]
	])("da %i con %s su %i opzioni → %i", (from, key, count, to) => {
		expect(nextIndex(from, key, count)).toBe(to);
	});

	it("un tasto qualunque non muove niente", () => {
		expect(nextIndex(0, "a", 3)).toBeNull();
	});
});

describe("la ricerca in un menu filtra per nome, parole chiave e gruppo", () => {
	const groups = [
		{ id: "a", label: "OpenAI", items: [{ value: "gpt", label: "GPT Image" }] },
		{ id: "b", label: "Google", items: [{ value: "nb", label: "Nano Banana", keywords: "gemini" }] }
	];

	it("per nome del gruppo", () => {
		expect(filterGroups(groups, "openai").map((g) => g.id)).toEqual(["a"]);
	});

	it("per parola chiave", () => {
		expect(filterGroups(groups, "GEMINI")[0].items[0].value).toBe("nb");
	});

	it("vuota: tutto", () => {
		expect(filterGroups(groups, "  ")).toBe(groups);
	});
});
