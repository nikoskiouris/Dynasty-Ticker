// Nicknames people type for players: "JSN", "CMC", "Sun God". One table, so
// the talk box, Players search and the trade search all read them the same way.
export const PLAYER_ALIASES = Object.freeze({
  cmc: "christian mccaffrey",
  arsb: "amon ra st brown",
  "sun god": "amon ra st brown",
  jsn: "jaxon smith njigba",
  btj: "brian thomas",
  mhj: "marvin harrison",
  ajb: "aj brown",
  jj: "justin jefferson",
  jjeff: "justin jefferson",
  jt: "jonathan taylor",
  kw3: "kenneth walker",
  dk: "dk metcalf",
  tmac: "terry mclaurin",
  tmcl: "terry mclaurin",
  tet: "tetairoa mcmillan",
  hollywood: "marquise brown",
  "a j brown": "aj brown",
  "d k metcalf": "dk metcalf",
  "c j stroud": "cj stroud",
  "t j hockenson": "tj hockenson",
  "j k dobbins": "jk dobbins",
});

// The name a nickname stands for, in lower-case words, or "" when it is not one.
export function playerAliasName(text) {
  const key = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return PLAYER_ALIASES[key] || "";
}
