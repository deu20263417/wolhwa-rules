/* 첫 화면이 그려지기 전에 테마를 정한다 (깜빡임 방지). 기본은 다크. CSP 때문에 인라인이 아닌 별도 파일. */
(function () {
  try {
    var t = localStorage.getItem("wolhwa-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    if (t === "light") { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", "#f7f2f3"); }
  } catch (e) {}
})();
