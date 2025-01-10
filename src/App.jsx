import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCards, setFilteredCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);

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

  const handleCardClick = (card) => {
    setSelectedCards((prevSelectedCards) => [...prevSelectedCards, card]);
    setSearchTerm(""); // Clear search term to close the dropdown
  };

  const handleDeleteLastCard = () => {
    setSelectedCards((prevSelectedCards) => prevSelectedCards.slice(0, -1));
  };

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
              <div
                key={card.id}
                className="dropdown-item"
                onClick={() => handleCardClick(card)}
              >
                {card.name}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="currentHand">Hand</div>
      <div className="deck">
        <h2>Deck</h2>
        {selectedCards.map((card, index) => (
          <img
            key={index}
            src={card.card_images[0].image_url_small}
            alt={card.name}
          />
        ))}
      </div>
      <div className="targetMonster">Search Target</div>
      <button onClick={handleDeleteLastCard}>Delete Previous Card</button>
    </>
  );
}

export default App;
