/** What may be pinned on: a literal substring, or a pattern. Neither may match twice. */
export type Anchor = string | RegExp;
export interface Citation {
    /** The file that was read, exactly as it was passed in. */
    readonly file: string;
    /** The one line that matched, 1-based, so it can be printed as `path:line`. */
    readonly line: number;
    /** The text of that line, for a failure message that shows what was found. */
    readonly text: string;
    /** Every line of the file, so {@link block} needs no second read. */
    readonly lines: readonly string[];
}
/**
 * The one line of `file` matching `anchor`.
 *
 * @throws if the file does not exist, if nothing matches, or if more than one line matches.
 */
export declare function cite(file: string, anchor: Anchor): Citation;
/**
 * {@link cite}, except that an ABSENT FILE yields null instead of throwing — for a citation into a
 * sibling repository that may not be checked out.
 *
 * Null means "not measured". It does not mean "fine". Turn it into `t.skip('…')` so a run that
 * could not check something says so; `if (c === null) return` is how a suite comes to report a
 * pass for work it never did.
 *
 * A file that IS present is held to every rule {@link cite} applies. Being optional about whether
 * the repository is there is not being optional about whether the claim holds.
 */
export declare function citeIfPresent(file: string, anchor: Anchor): Citation | null;
/**
 * `count` lines of the file starting at the citation — the block the anchor heads.
 *
 * Returned joined, so a claim about the block is one `assert.match` away. It is deliberately NOT
 * padded when the anchor sits near the end of the file: a short block fails an assertion, which is
 * the correct outcome for a file that has lost the body being cited.
 */
export declare function block(citation: Citation, count: number): string;
