const params = new URLSearchParams(location.search);
const starters = document.getElementById("starters");
const bench = document.getElementById("bench");

document.querySelectorAll(".seg-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const showBench = button.dataset.show === "bench";
    starters.hidden = showBench;
    bench.hidden = !showBench;
    document.querySelectorAll(".seg-btn").forEach((item) => {
      const on = item === button;
      item.classList.toggle("on", on);
      item.setAttribute("aria-selected", on ? "true" : "false");
    });
  });
});

if (params.get("lineup") === "bench") {
  document.querySelector('[data-show="bench"]').click();
}
