import { useState, useCallback, useRef } from "react";

const API_BASE = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

// --- Small World Logic ---
function countSharedProps(a, b) {
  let shared = 0;
  if (a.type === b.type) shared++;
  if (a.attribute === b.attribute) shared++;
  if (a.level === b.level) shared++;
  if (a.atk === b.atk) shared++;
  if (a.def === b.def) shared++;
  return shared;
}

function exactlyOneShared(a, b) {
  return countSharedProps(a, b) === 1;
}

function calculateSmallWorld(handMonster, deck, handCards) {
  const handIds = new Set(handCards.map(c => c.id));
  const seenTargets = new Map();
  for (const bridge of deck) {
    if (bridge.id === handMonster.id) continue;
    if (!exactlyOneShared(handMonster, bridge)) continue;
    for (const target of deck) {
      if (target.id === bridge.id) continue;
      if (target.id === handMonster.id) continue;
      if (handIds.has(target.id)) continue;
      if (!exactlyOneShared(bridge, target)) continue;
      if (!seenTargets.has(target.id)) {
        seenTargets.set(target.id, { target, bridges: [bridge] });
      } else {
        seenTargets.get(target.id).bridges.push(bridge);
      }
    }
  }
  return Array.from(seenTargets.values());
}

// --- Design tokens ---
const C = {
  bg:          "#1a1814",
  surface:     "#221f1b",
  border:      "#3a342c",
  borderStrong:"#5a4e42",
  ash:         "#857870",
  clay:        "#9a7a58",
  sand:        "#c2a47e",
  linen:       "#e6ddd0",
  accent:      "#b07030",
  accentMuted: "#6a4418",
  red:         "#8a3a2a",
  green:       "#3a6a3a",
};

const TYPE_SHORT = (t) => {
  if (!t) return "?";
  if (t.includes("Fusion"))   return "fusion";
  if (t.includes("Synchro"))  return "synchro";
  if (t.includes("XYZ") || t.includes("Xyz")) return "xyz";
  if (t.includes("Link"))     return "link";
  if (t.includes("Ritual"))   return "ritual";
  if (t.includes("Pendulum")) return "pendulum";
  if (t.includes("Tuner"))    return "tuner";
  if (t.includes("Effect"))   return "effect";
  if (t.includes("Normal"))   return "normal";
  return t.split(" ")[0].toLowerCase();
};

const injectStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Courier+Prime:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; }
  input::placeholder { color: ${C.ash}; opacity: 1; }
  input:focus { outline: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; }
`;

// --- Primitives ---
function Rule({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px" }}>
      {label && (
        <span style={{
          fontFamily: "'Courier Prime', monospace",
          fontSize: 8, letterSpacing: 4, color: C.ash, whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}>{label}</span>
      )}
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      fontFamily: "'Courier Prime', monospace",
      fontSize: 8, letterSpacing: 1, color: C.ash,
      border: `1px solid ${C.border}`,
      padding: "1px 4px",
    }}>{children}</span>
  );
}

function CardImg({ card, size = 48 }) {
  const url = card.card_images?.[0]?.image_url_small || card.card_images?.[0]?.image_url;
  return (
    <div style={{
      width: size, height: Math.round(size * 1.45), flexShrink: 0,
      background: C.surface, border: `1px solid ${C.border}`, overflow: "hidden",
    }}>
      {url && <img src={url} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
    </div>
  );
}

function CardStats({ card }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
      <Tag>lv {card.level}</Tag>
      <Tag>atk {card.atk}</Tag>
      <Tag>def {card.def}</Tag>
      <Tag>{(card.attribute || "").toLowerCase()}</Tag>
      <Tag>{TYPE_SHORT(card.type)}</Tag>
    </div>
  );
}

function CardRow({ card, onAdd, inDeck, count, onRemove, inHand, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 0",
        borderBottom: `1px solid ${C.border}`,
        cursor: onClick ? "pointer" : "default",
      }}>
      <CardImg card={card} size={46} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 13, fontWeight: 700, color: C.linen,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{card.name}</div>
        <CardStats card={card} />
      </div>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        {onAdd && !inDeck && (
          <button onClick={e => { e.stopPropagation(); onAdd(card); }} style={iconBtn(C.green)}>+</button>
        )}
        {inDeck && (
          <>
            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.clay }}>{count}×</span>
            <button onClick={e => { e.stopPropagation(); onRemove(card); }} style={iconBtn(C.red)}>−</button>
          </>
        )}
        {inHand && !inDeck && !onAdd && (
          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: 2, color: C.green }}>IN HAND</span>
        )}
      </div>
    </div>
  );
}

function iconBtn(col) {
  return {
    width: 24, height: 24,
    background: "transparent",
    border: `1px solid ${col}`,
    color: col,
    fontFamily: "'Courier Prime', monospace",
    fontSize: 14, fontWeight: 700,
    cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

// --- App ---
export default function SmallWorldApp() {
  const [tab, setTab]                     = useState(0);
  const [query, setQuery]                 = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [deck, setDeck]                   = useState([]);
  const [hand, setHand]                   = useState([]);
  const [revealed, setRevealed]           = useState(null);
  const [results, setResults]             = useState(null);
  const [openBridges, setOpenBridges]     = useState({});
  const timer = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`${API_BASE}?fname=${encodeURIComponent(q)}&type=effect monster,normal monster,ritual monster,fusion monster,synchro monster,xyz monster,link monster,pendulum effect monster,pendulum normal monster,tuner monster`);
      const d = await r.json();
      setSearchResults((d.data || []).filter(c => c.level !== undefined && c.atk !== undefined).slice(0, 20));
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  const handleQuery = q => {
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(q), 380);
  };

  const addToDeck = card => setDeck(p => {
    const x = p.find(e => e.card.id === card.id);
    if (x) return p.map(e => e.card.id === card.id ? { ...e, count: Math.min(e.count + 1, 3) } : e);
    return [...p, { card, count: 1 }];
  });

  const removeFromDeck = card => setDeck(p => {
    const x = p.find(e => e.card.id === card.id);
    if (!x) return p;
    if (x.count <= 1) return p.filter(e => e.card.id !== card.id);
    return p.map(e => e.card.id === card.id ? { ...e, count: e.count - 1 } : e);
  });

  const deckUnique   = deck.map(e => e.card);
  const deckFlatLen  = deck.reduce((s, e) => s + e.count, 0);

  const addToHand = card => {
    if (hand.find(c => c.id === card.id)) return;
    setHand(p => [...p, card]);
    setResults(null);
  };

  const removeFromHand = card => {
    setHand(p => p.filter(c => c.id !== card.id));
    if (revealed?.id === card.id) setRevealed(null);
    setResults(null);
  };

  const calculate = () => {
    if (!revealed || !deckUnique.length) return;
    setResults(calculateSmallWorld(revealed, deckUnique, hand));
    setOpenBridges({});
  };

  const toggleBridge = id => setOpenBridges(p => ({ ...p, [id]: !p[id] }));

  return (
    <>
      <style>{injectStyles}</style>
      <div style={{ minHeight: "100vh", background: C.bg, color: C.linen, fontSize: 14 }}>

        {/* HEADER */}
        <div style={{
          borderBottom: `1px solid ${C.borderStrong}`,
          padding: "22px 20px 18px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          position: "relative",
        }}>
          {/* Left copper bar */}
          <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: C.accent }} />
          <div style={{ paddingLeft: 14 }}>
            <div style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 8, letterSpacing: 5, color: C.ash,
              textTransform: "uppercase", marginBottom: 8,
            }}>
              yu-gi-oh / utility
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 32, fontWeight: 900,
              color: C.linen, lineHeight: 1, letterSpacing: -1,
            }}>
              small world
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic", fontSize: 13, color: C.clay, marginTop: 3,
            }}>
              bridge calculator
            </div>
          </div>
          <div style={{
            fontFamily: "'Courier Prime', monospace",
            fontSize: 8, letterSpacing: 2, color: C.border,
            textAlign: "right", lineHeight: 1.8,
          }}>
            TYPE<br/>ATTRIBUTE<br/>LEVEL<br/>ATK / DEF
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {["deck", "hand"].map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              flex: 1, padding: "11px 0",
              background: "transparent", border: "none",
              borderBottom: `2px solid ${tab === i ? C.accent : "transparent"}`,
              color: tab === i ? C.sand : C.ash,
              fontFamily: "'Courier Prime', monospace",
              fontSize: 10, letterSpacing: 5, textTransform: "uppercase",
              cursor: "pointer", marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        <div style={{ maxWidth: 620, margin: "0 auto", padding: "0 16px 60px" }}>

          {/* ---- TAB: DECK ---- */}
          {tab === 0 && (
            <>
              <Rule label="search" />
              <input
                value={query}
                onChange={e => handleQuery(e.target.value)}
                placeholder="search by name..."
                style={{
                  width: "100%", padding: "10px 12px",
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderLeft: `2px solid ${C.clay}`,
                  color: C.linen,
                  fontFamily: "'Courier Prime', monospace", fontSize: 13, letterSpacing: 0.5,
                }}
              />

              {searching && (
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: 4, color: C.ash, padding: "12px 0" }}>
                  searching...
                </div>
              )}

              {searchResults.length > 0 && (
                <>
                  <Rule label={`${searchResults.length} results`} />
                  {searchResults.map(card => {
                    const inDeck = deck.find(e => e.card.id === card.id);
                    return <CardRow key={card.id} card={card} onAdd={addToDeck} onRemove={removeFromDeck} inDeck={!!inDeck} count={inDeck?.count} />;
                  })}
                </>
              )}

              <Rule label={`deck  ${deckFlatLen} cards`} />

              {deck.length === 0 ? (
                <div style={{
                  border: `1px solid ${C.border}`, padding: "28px",
                  textAlign: "center",
                  fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: 3, color: C.border,
                }}>
                  no cards added yet
                </div>
              ) : (
                <>
                  {deck.map(({ card, count }) => (
                    <CardRow key={card.id} card={card} onRemove={removeFromDeck} inDeck count={count} />
                  ))}
                  <div style={{ marginTop: 16 }}>
                    <button onClick={() => setDeck([])} style={{
                      background: "transparent", border: `1px solid ${C.border}`,
                      color: C.ash, fontFamily: "'Courier Prime', monospace",
                      fontSize: 8, letterSpacing: 3, padding: "6px 12px",
                      cursor: "pointer", textTransform: "uppercase",
                    }}>clear all</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ---- TAB: HAND ---- */}
          {tab === 1 && (
            <>
              <Rule label="hand" />

              {hand.length === 0 ? (
                <div style={{
                  border: `1px solid ${C.border}`, padding: "20px",
                  fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: 3, color: C.border, textAlign: "center"
                }}>
                  select monsters from deck below
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 0, border: `1px solid ${C.border}` }}>
                  {hand.map(card => {
                    const isRev = revealed?.id === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setRevealed(p => p?.id === card.id ? null : card)}
                        style={{
                          padding: 8, cursor: "pointer",
                          background: isRev ? C.accentMuted : "transparent",
                          borderRight: `1px solid ${C.border}`,
                          borderBottom: `1px solid ${C.border}`,
                          borderTop: `2px solid ${isRev ? C.accent : "transparent"}`,
                          position: "relative",
                          transition: "background 0.12s",
                        }}>
                        <CardImg card={card} size={54} />
                        {isRev && (
                          <div style={{
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 7, letterSpacing: 3, color: C.accent,
                            textAlign: "center", marginTop: 4,
                          }}>reveal</div>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); removeFromHand(card); }}
                          style={{
                            position: "absolute", top: 2, right: 2,
                            background: C.bg, border: `1px solid ${C.border}`,
                            color: C.ash, width: 14, height: 14,
                            fontSize: 8, cursor: "pointer", padding: 0,
                            fontFamily: "'Courier Prime', monospace",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>x</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {revealed && (
                <div style={{
                  marginTop: 10,
                  borderLeft: `2px solid ${C.accent}`, paddingLeft: 10,
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: 9, letterSpacing: 1, color: C.clay,
                }}>
                  revealing — <span style={{ color: C.sand, fontStyle: "italic" }}>{revealed.name}</span>
                </div>
              )}

              {/* Activate */}
              <div style={{ marginTop: 16, marginBottom: 4 }}>
                <button
                  onClick={calculate}
                  disabled={!revealed || !deckUnique.length}
                  style={{
                    width: "100%", padding: "13px 0",
                    background: revealed && deckUnique.length ? C.accent : "transparent",
                    border: `1px solid ${revealed && deckUnique.length ? C.accent : C.border}`,
                    color: revealed && deckUnique.length ? C.bg : C.border,
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 10, letterSpacing: 5, textTransform: "uppercase", fontWeight: 700,
                    cursor: revealed && deckUnique.length ? "pointer" : "not-allowed",
                  }}>
                  activate small world
                </button>
              </div>

              {/* Results */}
              {results !== null && (
                <>
                  {/* Score block */}
                  <div style={{
                    display: "flex",
                    borderLeft: `3px solid ${results.length > 0 ? C.accent : C.red}`,
                    borderBottom: `1px solid ${C.border}`,
                    padding: "16px 16px 14px",
                    marginBottom: 14, marginTop: 8,
                    background: C.surface,
                    alignItems: "flex-end", gap: 16,
                  }}>
                    <div style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: 52, fontWeight: 900, lineHeight: 1,
                      color: results.length > 0 ? C.sand : C.red,
                    }}>{results.length}</div>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 14, color: C.clay }}>
                        {results.length === 1 ? "monster reachable" : "monsters reachable"}
                      </div>
                      {results.length === 0 && (
                        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.ash, marginTop: 4, letterSpacing: 1 }}>
                          no valid bridge — try another monster
                        </div>
                      )}
                    </div>
                  </div>

                  {results.map(({ target, bridges }) => (
                    <div key={target.id} style={{
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      marginBottom: 6,
                    }}>
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
                        <CardImg card={target} size={46} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 13, fontWeight: 700, color: C.linen,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>{target.name}</div>
                          <CardStats card={target} />
                        </div>
                        <button
                          onClick={() => toggleBridge(target.id)}
                          style={{
                            background: "transparent", border: `1px solid ${C.border}`,
                            color: C.ash,
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 8, letterSpacing: 2, padding: "4px 8px",
                            cursor: "pointer", flexShrink: 0, textTransform: "uppercase",
                          }}>
                          {openBridges[target.id] ? "hide" : `${bridges.length} bridge${bridges.length > 1 ? "s" : ""}`}
                        </button>
                      </div>

                      {openBridges[target.id] && (
                        <div style={{
                          borderTop: `1px solid ${C.border}`,
                          padding: "10px 12px", background: C.bg,
                        }}>
                          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: 4, color: C.ash, marginBottom: 10 }}>
                            via bridge
                          </div>
                          {bridges.map(b => (
                            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <CardImg card={b} size={38} />
                              <div>
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, color: C.sand }}>{b.name}</div>
                                <CardStats card={b} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Deck picker */}
              <Rule label="deck — tap to add to hand" />
              {deck.length === 0 ? (
                <div style={{
                  border: `1px solid ${C.border}`, padding: "20px",
                  fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: 3, color: C.border, textAlign: "center"
                }}>build your deck first</div>
              ) : deck.map(({ card }) => (
                <CardRow
                  key={card.id}
                  card={card}
                  inHand={!!hand.find(c => c.id === card.id)}
                  onClick={() => addToHand(card)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}