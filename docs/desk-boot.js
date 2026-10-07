try {
  if (localStorage.getItem("dynasty_ticker_board") === "shut") {
    document.documentElement.classList.add("desk-shut");
  }
} catch (err) {}
