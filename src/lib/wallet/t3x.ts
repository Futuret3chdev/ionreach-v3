export const T3X_MINT = (import.meta.env.VITE_T3X_MINT as string | undefined)?.trim() ?? "";
export const T3X_DECIMALS = 6;
export const BUY_URL = T3X_MINT ? `https://jup.ag/swap/SOL-${T3X_MINT}` : "";

export async function t3xBalance(owner: string): Promise<number | null> {
  if (!T3X_MINT) return null;
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [owner, { mint: T3X_MINT }, { encoding: "jsonParsed" }],
    }),
  });
  const body = (await res.json()) as { result?: { value?: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[] } };
  const accounts = body.result?.value ?? [];
  return accounts.reduce((sum, row) => sum + (row.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
}
