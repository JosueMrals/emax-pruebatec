import { StyleSheet } from "@react-pdf/renderer";

// Built-in Helvetica covers Spanish accents and the euro sign (WinAnsi encoding).
export const pdf = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#1a1a1a", lineHeight: 1.35 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  label: { fontSize: 8, color: "#666666", textTransform: "uppercase", marginBottom: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#666666" },
  box: { borderWidth: 1, borderColor: "#dddddd", borderRadius: 3, padding: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#dddddd" },
  right: { textAlign: "right" },
  note: { marginTop: 12, padding: 8, backgroundColor: "#f3f3f3", borderRadius: 3 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#888888", textAlign: "center" },
});
