export interface WallexOrderbooks {
  exchangeName : string;
  tmnPairs: { [pair: string]: { bid: string[]; ask: string[] } };
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

export interface OkexOrderbooks {
  exchangeName : string;
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}