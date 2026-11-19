/* 예전 주소(page.html?doc=ID)를 위키 주소(#...)로 옮긴다. CSP 때문에 별도 파일. */
(function () {
  var MAP = { start: "cat-start", raid: "cat-raid", base: "rule-12", clan: "cat-clan", war: "war", penalty: "penalty",
    cases: "cases", help: "cat-help", report: "report", changelog: "changelog", rules: "rules", search: "search", faq: "faq", notice: "notice" };
  var id = new URLSearchParams(location.search).get("doc");
  var to = (id && Object.prototype.hasOwnProperty.call(MAP, id)) ? MAP[id] : "home";
  location.replace("./#" + to);
})();
