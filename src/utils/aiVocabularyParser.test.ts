import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanCodeFences,
  parseAiVocabularyJson,
  parsePlainTextWords,
  parseAnyWordsInput,
} from "./aiVocabularyParser";
import { guessClientLemmas } from "./api";

test("cleanCodeFences removes markdown ```json and ``` fences", () => {
  const input = "```json\n{\"words\":[{\"word\":\"test\"}]}\n```";
  assert.equal(cleanCodeFences(input), '{"words":[{"word":"test"}]}');
});

test("parseAiVocabularyJson parses valid JSON object with words array", () => {
  const json = JSON.stringify({
    words: [
      {
        word: "ubiquitous",
        translation: "вездесущий",
        ipa: "/juːˈbɪk.wɪ.təs/",
        explanation: "Present, appearing, or found everywhere.",
        example: "Smartphones have become ubiquitous.",
      },
    ],
  });

  const result = parseAiVocabularyJson(json);
  assert.equal(result.length, 1);
  assert.equal(result[0].word, "ubiquitous");
  assert.equal(result[0].translation, "вездесущий");
  assert.equal(result[0].ipa, "/juːˈbɪk.wɪ.təs/");
});

test("parsePlainTextWords parses single words per line", () => {
  const text = `
    serendipity
    ubiquitous
    ephemeral
  `;
  const result = parsePlainTextWords(text);
  assert.equal(result.length, 3);
  assert.equal(result[0].word, "serendipity");
  assert.equal(result[1].word, "ubiquitous");
  assert.equal(result[2].word, "ephemeral");
});

test("parsePlainTextWords parses words with inline translations", () => {
  const text = `
    1. serendipity - счастливая случайность
    2. ubiquitous : omnipresent
    3. ephemeral = fleeting
  `;
  const result = parsePlainTextWords(text);
  assert.equal(result.length, 3);
  assert.equal(result[0].word, "serendipity");
  assert.equal(result[0].translation, "счастливая случайность");
  assert.equal(result[1].word, "ubiquitous");
  assert.equal(result[1].translation, "omnipresent");
});

test("parseAnyWordsInput seamlessly parses markdown fenced JSON", () => {
  const input = "```json\n{\"words\":[{\"word\":\"resilience\",\"translation\":\"стойкость\"}]}\n```";
  const result = parseAnyWordsInput(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].word, "resilience");
  assert.equal(result[0].translation, "стойкость");
});

test("parseAnyWordsInput seamlessly falls back to plain text", () => {
  const input = "apple\nbanana\norange";
  const result = parseAnyWordsInput(input);
  assert.equal(result.length, 3);
  assert.equal(result[0].word, "apple");
});

test("guessClientLemmas resolves inflected forms and Kindle stems", () => {
  const lemmas = guessClientLemmas("memories", "memory");
  assert.ok(lemmas.includes("memory"));
  assert.ok(lemmas.includes("memories"));

  const verbLemmas = guessClientLemmas("fascinated");
  assert.ok(verbLemmas.includes("fascinate"));
});

