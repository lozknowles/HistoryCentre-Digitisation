import React from "react";
import ReactDOM from "react-dom/client";
import PublicArchive from "../src/public-site/PublicArchive";
import "../src/public-site/public.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PublicArchive />
  </React.StrictMode>,
);
