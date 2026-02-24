import { useState, useEffect, useCallback, useRef } from "react";

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
  // handCards = all monsters in hand (to exclude from targets)
  const handIds = new Set(handCards.map(c => c.id));
  
  const results = [];
  
  for (const bridge of deck) {
    if (bridge.id === handMonster.id) continue;
    if (!exactlyOneShared(handMonster, bridge)) continue;
    
    // Find targets
    for (const target of deck) {
      if (target.id === bridge.id) continue;
      if (target.id === handMonster.id) continue;
      if (handIds.has(target.id)) continue; // can't add from deck if it's in hand
      if (!exactlyOneShared(bridge, target)) continue;
      
      results.push({ bridge, target });
    }
  }
  
  // Deduplicate targets (same target can be reached via multiple bridges)
  const seenTargets = new Map();
  for (const r of results) {
    if (!seenTargets.has(r.target.id)) {
      seenTargets.set(r.target.id, { target: r.target, bridges: [r.bridge] });
    } else {
      seenTargets.get(r.target.id).bridges.push(r.bridge);
    }
  }
  
  return Array.from(seenTargets.values());
}

// --- Components ---
function CardImage({ card, size = "sm" }) {
  const sizes = { sm: 60, md: 80, lg: 120 };
  const px = sizes[size];
  const imgUrl = card.card_images?.[0]?.image_url_small || card.card_images?.[0]?.image_url;
  
  return (
    <div style={{
      width: px, height: px * 1.45,
      borderRadius: 4,
      overflow: "hidden",
      flexShrink: 0,
      border: "1px solid rgba(255,200,50,0.3)",
      background: "#1a1020",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
    }}>
      {imgUrl && <img src={imgUrl} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <span style={{
      display: "inline-flex", gap: 3, alignItems: "center",
      background: "rgba(255,200,50,0.08)",
      border: "1px solid rgba(255,200,50,0.2)",
      borderRadius: 3, padding: "1px 5px",
      fontSize: 10, color: "#c8a84b", fontFamily: "monospace"
    }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ color: "#f0d060" }}>{value}</span>
    </span>
  );
}

function CardRow({ card, onAdd, onRemove, inDeck, count, small }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px",
      background: "rgba(255,255,255,0.03)",
      borderRadius: 6,
      border: "1px solid rgba(255,200,50,0.1)",
      marginBottom: 4
    }}>
      <CardImage card={card} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontSize: 12, fontWeight: 700, color: "#f0e0a0",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          fontFamily: "'Cinzel', serif"
        }}>{card.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
          <StatBadge label="LV" value={card.level} />
          <StatBadge label="ATK" value={card.atk} />
          <StatBadge label="DEF" value={card.def} />
          <StatBadge label="" value={card.attribute} />
          <StatBadge label="" value={card.type?.replace(" Monster","").replace(" Pendulum","").split(" ").slice(-1)[0]} />
        </div>
      </div>
      {onAdd && !inDeck && (
        <button onClick={() => onAdd(card)} style={btnStyle("#2a4a2a","#4aff4a")}>+</button>
      )}
      {inDeck && (
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ color:"#f0d060", fontSize:13, fontFamily:"monospace", minWidth:16, textAlign:"center" }}>
            {count}×
          </span>
          <button onClick={() => onRemove(card)} style={btnStyle("#4a2a2a","#ff6060")}>−</button>
        </div>
      )}
      {small && <div style={{ color:"#4aff4a", fontSize:10 }}>✓</div>}
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    background: bg, color, border: `1px solid ${color}44`,
    borderRadius: 4, width: 26, height: 26, cursor: "pointer",
    fontSize: 16, display:"flex", alignItems:"center", justifyContent:"center",
    flexShrink: 0, fontWeight: 700, padding: 0
  };
}

// Tabs
const TABS = ["🃏 Build Deck", "⚡ Calculate"];

export default function SmallWorldApp() {
  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [deck, setDeck] = useState([]); // [{card, count}]
  const [results, setResults] = useState(null); // [{target, bridges}]
  const [selectedHand, setSelectedHand] = useState(null); // which deck monster to reveal
  const [expandedBridges, setExpandedBridges] = useState({});
  const debounceRef = useRef(null);

  // Save/load deck from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sw_deck");
      if (saved) setDeck(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sw_deck", JSON.stringify(deck));
    } catch {}
  }, [deck]);

  const searchCards = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}?fname=${encodeURIComponent(q)}&type=effect monster,normal monster,ritual monster,fusion monster,synchro monster,xyz monster,link monster,pendulum effect monster,pendulum normal monster,tuner monster`);
      const data = await res.json();
      // Filter to monsters with level/atk/def (Small World compatible)
      const cards = (data.data || []).filter(c => c.level !== undefined && c.atk !== undefined && c.def !== undefined);
      setSearchResults(cards.slice(0, 20));
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCards(q), 400);
  };

  const addToDeck = (card) => {
    setDeck(prev => {
      const existing = prev.find(e => e.card.id === card.id);
      if (existing) {
        return prev.map(e => e.card.id === card.id ? { ...e, count: Math.min(e.count + 1, 3) } : e);
      }
      return [...prev, { card, count: 1 }];
    });
  };

  const removeFromDeck = (card) => {
    setDeck(prev => {
      const existing = prev.find(e => e.card.id === card.id);
      if (!existing) return prev;
      if (existing.count <= 1) return prev.filter(e => e.card.id !== card.id);
      return prev.map(e => e.card.id === card.id ? { ...e, count: e.count - 1 } : e);
    });
  };

  const deckFlat = deck.flatMap(e => Array(e.count).fill(e.card));
  const deckUnique = deck.map(e => e.card);

  const toggleReveal = (card) => {
    setSelectedHand(prev => prev?.id === card.id ? null : card);
    setResults(null);
  };

  const calculate = () => {
    if (!selectedHand) return;
    const res = calculateSmallWorld(selectedHand, deckUnique, []);
    setResults(res);
    setExpandedBridges({});
  };

  const toggleBridge = (targetId) => {
    setExpandedBridges(prev => ({ ...prev, [targetId]: !prev[targetId] }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      boxSizing: "border-box",
      background: "radial-gradient(ellipse at 20% 0%, #1a0828 0%, #0d0d1a 40%, #060610 100%)",
      color: "#e8d8b0",
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: 14,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a0828 0%, #2a1040 50%, #1a0828 100%)",
        borderBottom: "1px solid rgba(255,200,50,0.3)",
        padding: "16px 20px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 100%, rgba(200,100,255,0.15) 0%, transparent 70%)"
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: "#f0d060", fontFamily: "'Cinzel', serif", textShadow: "0 0 20px rgba(240,200,80,0.5)" }}>
            ⚡ SMALL WORLD
          </div>
          <div style={{ fontSize: 10, letterSpacing: 5, color: "#a080c0", marginTop: 2 }}>CALCULATOR</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,200,50,0.2)" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex: 1, padding: "12px 8px", border: "none", cursor: "pointer",
            background: tab === i ? "rgba(255,200,50,0.1)" : "transparent",
            color: tab === i ? "#f0d060" : "#806040",
            borderBottom: tab === i ? "2px solid #f0d060" : "2px solid transparent",
            fontSize: 12, fontWeight: 700, letterSpacing: 1,
            transition: "all 0.2s"
          }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 600, width: "100%", margin: "0 auto", padding: "16px 12px", boxSizing: "border-box" }}>

        {/* TAB 0: BUILD DECK */}
        {tab === 0 && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <input
                placeholder="🔍 Search monster cards..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,200,50,0.3)",
                  borderRadius: 8, color: "#f0e0a0", fontSize: 14,
                  outline: "none"
                }}
              />
            </div>

            {searching && <div style={{ color: "#a080c0", textAlign:"center", padding: 16 }}>Searching...</div>}

            {searchResults.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#806040", marginBottom: 8 }}>SEARCH RESULTS</div>
                {searchResults.map(card => {
                  const inDeck = deck.find(e => e.card.id === card.id);
                  return <CardRow key={card.id} card={card} onAdd={addToDeck} onRemove={removeFromDeck} inDeck={!!inDeck} count={inDeck?.count} />;
                })}
              </div>
            )}

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#806040" }}>YOUR DECK ({deckFlat.length} monsters)</div>
                {deck.length > 0 && <button onClick={() => setDeck([])} style={{ background:"none", border:"none", color:"#ff6060", cursor:"pointer", fontSize:11 }}>Clear</button>}
              </div>
              {deck.length === 0 && (
                <div style={{ textAlign:"center", color:"#504030", padding:24, border:"1px dashed rgba(255,200,50,0.1)", borderRadius:8 }}>
                  Search and add monsters to build your deck
                </div>
              )}
              {deck.map(({ card, count }) => (
                <CardRow key={card.id} card={card} onRemove={removeFromDeck} inDeck count={count} />
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: CALCULATE */}
        {tab === 1 && (
          <div>
            {/* Reveal selector + activate */}
            <div style={{ marginBottom: 16 }}>
              {selectedHand ? (
                <div style={{ color:"#c0a040", fontSize:11, marginBottom:8 }}>
                  Revealing: <strong style={{color:"#f0d060"}}>{selectedHand.name}</strong>
                </div>
              ) : (
                <div style={{ color:"#504030", textAlign:"center", padding:"10px 0", fontSize:11, marginBottom:8 }}>
                  Tap a monster below to select it as the card you reveal from hand
                </div>
              )}

              <button
                onClick={calculate}
                disabled={!selectedHand || deckUnique.length === 0}
                style={{
                  width:"100%", padding:"12px",
                  background: selectedHand && deckUnique.length > 0
                    ? "linear-gradient(135deg, #4a2080, #8040c0)"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(200,100,255,0.4)",
                  borderRadius: 8, color: selectedHand && deckUnique.length > 0 ? "#fff" : "#504040",
                  fontSize: 14, fontWeight: 700, cursor: selectedHand && deckUnique.length > 0 ? "pointer" : "not-allowed",
                  letterSpacing: 2, transition: "all 0.2s"
                }}>
                ⚡ ACTIVATE SMALL WORLD
              </button>
            </div>

            {/* Deck — tap to select reveal card */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#806040", marginBottom: 8 }}>
                DECK ({deckUnique.length} monsters) — tap to reveal
              </div>
              {deck.length === 0 && (
                <div style={{ color:"#504030", textAlign:"center", padding:16 }}>
                  Build your deck in the first tab
                </div>
              )}
              {deck.map(({ card }) => (
                <div key={card.id} onClick={() => toggleReveal(card)} style={{ cursor:"pointer" }}>
                  <CardRow card={card} small={selectedHand?.id === card.id} />
                </div>
              ))}
            </div>

            {/* Results */}
            {results !== null && (
              <div>
                <div style={{
                  padding: "12px 14px",
                  background: "rgba(200,100,255,0.08)",
                  border: "1px solid rgba(200,100,255,0.3)",
                  borderRadius: 8, marginBottom: 12
                }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: "#a080c0" }}>SMALL WORLD RESULTS</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: results.length > 0 ? "#f0d060" : "#ff6060" }}>
                    {results.length} {results.length === 1 ? "monster" : "monsters"} reachable
                  </div>
                  {results.length === 0 && (
                    <div style={{ color:"#806040", fontSize:11, marginTop:4 }}>
                      No valid bridges found with this hand monster.
                    </div>
                  )}
                </div>

                {results.map(({ target, bridges }) => (
                  <div key={target.id} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,200,50,0.15)",
                    borderRadius: 8, marginBottom: 8, overflow:"hidden"
                  }}>
                    {/* Target */}
                    <div style={{ padding: "10px 12px", display:"flex", alignItems:"center", gap:10 }}>
                      <CardImage card={target} size="sm" />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#f0d060", fontFamily:"'Cinzel',serif" }}>
                          {target.name}
                        </div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:3 }}>
                          <StatBadge label="LV" value={target.level} />
                          <StatBadge label="ATK" value={target.atk} />
                          <StatBadge label="DEF" value={target.def} />
                          <StatBadge label="" value={target.attribute} />
                        </div>
                      </div>
                      <button onClick={() => toggleBridge(target.id)} style={{
                        background:"rgba(255,200,50,0.1)", border:"1px solid rgba(255,200,50,0.2)",
                        color:"#c0a040", borderRadius:4, padding:"4px 8px", cursor:"pointer", fontSize:10
                      }}>
                        {expandedBridges[target.id] ? "▲" : "▼"} {bridges.length} bridge{bridges.length>1?"s":""}
                      </button>
                    </div>

                    {/* Bridges */}
                    {expandedBridges[target.id] && (
                      <div style={{ borderTop:"1px solid rgba(255,200,50,0.1)", padding:"8px 12px", background:"rgba(0,0,0,0.2)" }}>
                        <div style={{ fontSize:10, color:"#806040", letterSpacing:2, marginBottom:6 }}>VIA BRIDGE:</div>
                        {bridges.map(bridge => (
                          <div key={bridge.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                            <CardImage card={bridge} size="sm" />
                            <div>
                              <div style={{ fontSize:11, color:"#c0a060", fontWeight:700 }}>{bridge.name}</div>
                              <div style={{ display:"flex", gap:3, marginTop:2 }}>
                                <StatBadge label="LV" value={bridge.level} />
                                <StatBadge label="ATK" value={bridge.atk} />
                                <StatBadge label="DEF" value={bridge.def} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap" rel="stylesheet" />
    </div>
  );
}
