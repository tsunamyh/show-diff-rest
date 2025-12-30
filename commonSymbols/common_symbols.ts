interface Coin {
  count: number;
  timestamp: string;
  symbols: {
    binance_symbol: string[];
    wallex_symbol: { 
      "tmnPairs": {
        [pair: string]: {
        "amount_precision": number;
        "price_precision": number;
      }};
      "usdtPairs": {
        [pair: string]: {
        "amount_precision": number;
        "price_precision": number;
      }};
    };
  };
} 

const  binance_wallex_common_symbols: Coin = {
  "count": 153,
  "timestamp": "2025-12-30T13:33:45.264Z",
  "symbols": {
    "binance_symbol": [
      "BTCUSDT",
      "ETHUSDT",
      "BNBUSDT",
      "LTCUSDT",
      "ADAUSDT",
      "XRPUSDT",
      "XLMUSDT",
      "TRXUSDT",
      "ETCUSDT",
      "USDCUSDT",
      "LINKUSDT",
      "HOTUSDT",
      "ZILUSDT",
      "ZRXUSDT",
      "FETUSDT",
      "BATUSDT",
      "ZECUSDT",
      "CELRUSDT",
      "DASHUSDT",
      "ENJUSDT",
      "ATOMUSDT",
      "ONEUSDT",
      "ALGOUSDT",
      "DOGEUSDT",
      "CVCUSDT",
      "CHZUSDT",
      "BANDUSDT",
      "XTZUSDT",
      "HBARUSDT",
      "BCHUSDT",
      "SOLUSDT",
      "MDTUSDT",
      "LRCUSDT",
      "ZENUSDT",
      "SNXUSDT",
      "MANAUSDT",
      "YFIUSDT",
      "JSTUSDT",
      "CRVUSDT",
      "SANDUSDT",
      "NMRUSDT",
      "DOTUSDT",
      "PAXGUSDT",
      "TRBUSDT",
      "SUSHIUSDT",
      "EGLDUSDT",
      "RUNEUSDT",
      "UMAUSDT",
      "UNIUSDT",
      "AVAXUSDT",
      "AAVEUSDT",
      "NEARUSDT",
      "FILUSDT",
      "AXSUSDT",
      "SKLUSDT",
      "GRTUSDT",
      "1INCHUSDT",
      "CAKEUSDT",
      "OMUSDT",
      "ALICEUSDT",
      "SUPERUSDT",
      "SLPUSDT",
      "SHIBUSDT",
      "ICPUSDT",
      "MASKUSDT",
      "LPTUSDT",
      "DEXEUSDT",
      "QNTUSDT",
      "FLOWUSDT",
      "RAYUSDT",
      "DYDXUSDT",
      "GALAUSDT",
      "AGLDUSDT",
      "JASMYUSDT",
      "BICOUSDT",
      "CVXUSDT",
      "PEOPLEUSDT",
      "IMXUSDT",
      "API3USDT",
      "BTTCUSDT",
      "TUSDT",
      "GMTUSDT",
      "APEUSDT",
      "NEXOUSDT",
      "APTUSDT",
      "OSMOUSDT",
      "MAGICUSDT",
      "ARBUSDT",
      "RDNTUSDT",
      "WBTCUSDT",
      "EDUUSDT",
      "SUIUSDT",
      "PEPEUSDT",
      "FLOKIUSDT",
      "WLDUSDT",
      "SEIUSDT",
      "TIAUSDT",
      "MEMEUSDT",
      "BONKUSDT",
      "JUPUSDT",
      "PYTHUSDT",
      "STRKUSDT",
      "WIFUSDT",
      "AEVOUSDT",
      "BOMEUSDT",
      "ETHFIUSDT",
      "ENAUSDT",
      "WUSDT",
      "TNSRUSDT",
      "TAOUSDT",
      "NOTUSDT",
      "IOUSDT",
      "RENDERUSDT",
      "TONUSDT",
      "DOGSUSDT",
      "POLUSDT",
      "NEIROUSDT",
      "TURBOUSDT",
      "CATIUSDT",
      "HMSTRUSDT",
      "EIGENUSDT",
      "KAIAUSDT",
      "ORCAUSDT",
      "MOVEUSDT",
      "PENGUUSDT",
      "BIOUSDT",
      "AIXBTUSDT",
      "CGPTUSDT",
      "COOKIEUSDT",
      "SUSDT",
      "LAYERUSDT",
      "KAITOUSDT",
      "FORMUSDT",
      "ONDOUSDT",
      "VIRTUALUSDT",
      "SYRUPUSDT",
      "KMNOUSDT",
      "AUSDT",
      "SAHARAUSDT",
      "PROVEUSDT",
      "LINEAUSDT",
      "PUMPUSDT",
      "AVNTUSDT",
      "SKYUSDT",
      "XPLUSDT",
      "2ZUSDT",
      "MORPHOUSDT",
      "ASTERUSDT",
      "GIGGLEUSDT",
      "KITEUSDT",
      "MMTUSDT",
      "BANKUSDT",
      "METUSDT"
    ],
    "wallex_symbol": {
      "tmnPairs": {
        "BTCTMN": {
          "amount_precision": 6,
          "price_precision": 0
        },
        "ETHTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "BNBTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "LTCTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "ADATMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "XRPTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "XLMTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "TRXTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "ETCTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "USDCTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "LINKTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "HOTTMN": {
          "amount_precision": 1,
          "price_precision": 2
        },
        "ZILTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ZRXTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "FETTMN": {
          "amount_precision": 4,
          "price_precision": 0
        },
        "BATTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ZECTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "CELRTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "DASHTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "ENJTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "ATOMTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ONETMN": {
          "amount_precision": 2,
          "price_precision": 1
        },
        "ALGOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "DOGETMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "CVCTMN": {
          "amount_precision": 2,
          "price_precision": 2
        },
        "CHZTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "BANDTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "XTZTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "HBARTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "BCHTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "SOLTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "MDTTMN": {
          "amount_precision": 0,
          "price_precision": 3
        },
        "LRCTMN": {
          "amount_precision": 2,
          "price_precision": 1
        },
        "ZENTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "SNXTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "MANATMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "YFITMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "JSTTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "CRVTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SANDTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "NMRTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "DOTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "PAXGTMN": {
          "amount_precision": 6,
          "price_precision": 0
        },
        "TRBTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "SUSHITMN": {
          "amount_precision": 3,
          "price_precision": 1
        },
        "EGLDTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "RUNETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "UMATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "UNITMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "AVAXTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "AAVETMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "NEARTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "FILTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "AXSTMN": {
          "amount_precision": 5,
          "price_precision": 0
        },
        "SKLTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "GRTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "1INCHTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "CAKETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "OMTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "ALICETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SUPERTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SLPTMN": {
          "amount_precision": 0,
          "price_precision": 2
        },
        "SHIBTMN": {
          "amount_precision": 0,
          "price_precision": 4
        },
        "ICPTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "MASKTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "LPTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "DEXETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "QNTTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "FLOWTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "RAYTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "DYDXTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "GALATMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "AGLDTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "JASMYTMN": {
          "amount_precision": 0,
          "price_precision": 0
        },
        "BICOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "CVXTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "PEOPLETMN": {
          "amount_precision": 4,
          "price_precision": 0
        },
        "IMXTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "API3TMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "BTTCTMN": {
          "amount_precision": 0,
          "price_precision": 6
        },
        "TTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "GMTTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "APETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "NEXOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "APTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "OSMOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "MAGICTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ARBTMN": {
          "amount_precision": 4,
          "price_precision": 0
        },
        "RDNTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "WBTCTMN": {
          "amount_precision": 6,
          "price_precision": 0
        },
        "EDUTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SUITMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "PEPETMN": {
          "amount_precision": 0,
          "price_precision": 4
        },
        "FLOKITMN": {
          "amount_precision": 0,
          "price_precision": 4
        },
        "WLDTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SEITMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "TIATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "MEMETMN": {
          "amount_precision": 4,
          "price_precision": 0
        },
        "BONKTMN": {
          "amount_precision": 0,
          "price_precision": 4
        },
        "JUPTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "PYTHTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "STRKTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "WIFTMN": {
          "amount_precision": 2,
          "price_precision": 1
        },
        "AEVOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "BOMETMN": {
          "amount_precision": 2,
          "price_precision": 1
        },
        "ETHFITMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ENATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "WTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "TNSRTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "TAOTMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "NOTTMN": {
          "amount_precision": 0,
          "price_precision": 1
        },
        "IOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "RENDERTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "TONTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "DOGSTMN": {
          "amount_precision": 2,
          "price_precision": 2
        },
        "POLTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "NEIROTMN": {
          "amount_precision": 1,
          "price_precision": 2
        },
        "TURBOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "CATITMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "HMSTRTMN": {
          "amount_precision": 2,
          "price_precision": 1
        },
        "EIGENTMN": {
          "amount_precision": 4,
          "price_precision": 0
        },
        "KAIATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ORCATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "MOVETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "PENGUTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "BIOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "AIXBTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "CGPTTMN": {
          "amount_precision": 2,
          "price_precision": 2
        },
        "COOKIETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "STMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "LAYERTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "KAITOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "FORMTMN": {
          "amount_precision": 2,
          "price_precision": 1
        },
        "ONDOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "VIRTUALTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SYRUPTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "KMNOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SAHARATMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "PROVETMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "LINEATMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "PUMPTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "AVNTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "SKYTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "XPLTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "2ZTMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "MORPHOTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "ASTERTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "GIGGLETMN": {
          "amount_precision": 3,
          "price_precision": 0
        },
        "KITETMN": {
          "amount_precision": 1,
          "price_precision": 0
        },
        "MMTTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "BANKTMN": {
          "amount_precision": 2,
          "price_precision": 0
        },
        "METTMN": {
          "amount_precision": 2,
          "price_precision": 0
        }
      },
      "usdtPairs": {
        "BTCUSDT": {
          "amount_precision": 6,
          "price_precision": 2
        },
        "ETHUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "BNBUSDT": {
          "amount_precision": 5,
          "price_precision": 4
        },
        "LTCUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "ADAUSDT": {
          "amount_precision": 1,
          "price_precision": 4
        },
        "XRPUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "XLMUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "TRXUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "ETCUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "USDCUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "LINKUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "HOTUSDT": {
          "amount_precision": 1,
          "price_precision": 7
        },
        "ZILUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "ZRXUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "FETUSDT": {
          "amount_precision": 4,
          "price_precision": 4
        },
        "BATUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "ZECUSDT": {
          "amount_precision": 3,
          "price_precision": 2
        },
        "CELRUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "DASHUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "ENJUSDT": {
          "amount_precision": 3,
          "price_precision": 5
        },
        "ATOMUSDT": {
          "amount_precision": 2,
          "price_precision": 2
        },
        "ONEUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "ALGOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "DOGEUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "CVCUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "CHZUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "BANDUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "XTZUSDT": {
          "amount_precision": 1,
          "price_precision": 3
        },
        "HBARUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "BCHUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "SOLUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "MDTUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "LRCUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "ZENUSDT": {
          "amount_precision": 3,
          "price_precision": 3
        },
        "SNXUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "MANAUSDT": {
          "amount_precision": 1,
          "price_precision": 4
        },
        "YFIUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "JSTUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "CRVUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SANDUSDT": {
          "amount_precision": 1,
          "price_precision": 4
        },
        "NMRUSDT": {
          "amount_precision": 3,
          "price_precision": 3
        },
        "DOTUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "PAXGUSDT": {
          "amount_precision": 6,
          "price_precision": 2
        },
        "TRBUSDT": {
          "amount_precision": 3,
          "price_precision": 4
        },
        "SUSHIUSDT": {
          "amount_precision": 3,
          "price_precision": 3
        },
        "EGLDUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "RUNEUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "UMAUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "UNIUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "AVAXUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "AAVEUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "NEARUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "FILUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "AXSUSDT": {
          "amount_precision": 5,
          "price_precision": 2
        },
        "SKLUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "GRTUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "1INCHUSDT": {
          "amount_precision": 1,
          "price_precision": 3
        },
        "CAKEUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "OMUSDT": {
          "amount_precision": 3,
          "price_precision": 5
        },
        "ALICEUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SUPERUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SLPUSDT": {
          "amount_precision": 4,
          "price_precision": 6
        },
        "SHIBUSDT": {
          "amount_precision": 0,
          "price_precision": 8
        },
        "ICPUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "MASKUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "LPTUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "DEXEUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "QNTUSDT": {
          "amount_precision": 3,
          "price_precision": 2
        },
        "FLOWUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "RAYUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "DYDXUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "GALAUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "AGLDUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "JASMYUSDT": {
          "amount_precision": 0,
          "price_precision": 5
        },
        "BICOUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "CVXUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "PEOPLEUSDT": {
          "amount_precision": 4,
          "price_precision": 5
        },
        "IMXUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "API3USDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "BTTCUSDT": {
          "amount_precision": 0,
          "price_precision": 8
        },
        "TUSDT": {
          "amount_precision": 2,
          "price_precision": 6
        },
        "GMTUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "APEUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "NEXOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "APTUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "OSMOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "MAGICUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "ARBUSDT": {
          "amount_precision": 4,
          "price_precision": 4
        },
        "RDNTUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "WBTCUSDT": {
          "amount_precision": 6,
          "price_precision": 2
        },
        "EDUUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SUIUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "PEPEUSDT": {
          "amount_precision": 0,
          "price_precision": 8
        },
        "FLOKIUSDT": {
          "amount_precision": 0,
          "price_precision": 8
        },
        "WLDUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "SEIUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "TIAUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "MEMEUSDT": {
          "amount_precision": 4,
          "price_precision": 5
        },
        "BONKUSDT": {
          "amount_precision": 0,
          "price_precision": 8
        },
        "JUPUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "PYTHUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "STRKUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "WIFUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "AEVOUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "BOMEUSDT": {
          "amount_precision": 2,
          "price_precision": 6
        },
        "ETHFIUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "ENAUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "WUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "TNSRUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "TAOUSDT": {
          "amount_precision": 3,
          "price_precision": 2
        },
        "NOTUSDT": {
          "amount_precision": 0,
          "price_precision": 6
        },
        "IOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "RENDERUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "TONUSDT": {
          "amount_precision": 2,
          "price_precision": 3
        },
        "DOGSUSDT": {
          "amount_precision": 2,
          "price_precision": 6
        },
        "POLUSDT": {
          "amount_precision": 1,
          "price_precision": 3
        },
        "NEIROUSDT": {
          "amount_precision": 1,
          "price_precision": 8
        },
        "TURBOUSDT": {
          "amount_precision": 2,
          "price_precision": 6
        },
        "CATIUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "HMSTRUSDT": {
          "amount_precision": 2,
          "price_precision": 6
        },
        "EIGENUSDT": {
          "amount_precision": 4,
          "price_precision": 4
        },
        "KAIAUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "ORCAUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "MOVEUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "PENGUUSDT": {
          "amount_precision": 1,
          "price_precision": 6
        },
        "BIOUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "AIXBTUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "CGPTUSDT": {
          "amount_precision": 2,
          "price_precision": 6
        },
        "COOKIEUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "SUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "LAYERUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "KAITOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "FORMUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "ONDOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "VIRTUALUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SYRUPUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "KMNOUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "AUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SAHARAUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "PROVEUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "LINEAUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "PUMPUSDT": {
          "amount_precision": 1,
          "price_precision": 6
        },
        "AVNTUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "SKYUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "XPLUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "2ZUSDT": {
          "amount_precision": 1,
          "price_precision": 4
        },
        "MORPHOUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "ASTERUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "GIGGLEUSDT": {
          "amount_precision": 3,
          "price_precision": 2
        },
        "KITEUSDT": {
          "amount_precision": 1,
          "price_precision": 5
        },
        "MMTUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        },
        "BANKUSDT": {
          "amount_precision": 2,
          "price_precision": 5
        },
        "METUSDT": {
          "amount_precision": 2,
          "price_precision": 4
        }
      }
    }
  }
} 

export default binance_wallex_common_symbols;