import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);
  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCards, setFilteredCards] = useState([]);

  useEffect(() => {
    fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php")
      .then((response) => response.json())
      .then((data) => setCards(data.data))
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  useEffect(() => {
    setFilteredCards(
      cards.filter((card) =>
        card.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, cards]);

  return (
    <>
      <h1>Smallworld Bridge Generator</h1>
      <div className="search">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <div className="dropdown">
            {filteredCards.map((card) => (
              <div key={card.id} className="dropdown-item">
                {card.name}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="currentHand">Hand</div>
      <div className="deck">Deck</div>
      <div className="targetMonster">Search Target</div>
    </>
  );
}

export default App;
