import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "./styles.css";
import App from "./App";
// After App so these rules come after the component stylesheets in the bundle and win ties.
import "./styles/board.css";
import "./styles/ui.css";
import { store } from "./store";
import { setUnauthorizedHandler } from "./services/api.services.js";
import { clearSession } from "./store/slices/auth.slices.js";

// Any expired/invalid token anywhere in the app signs the user out.
setUnauthorizedHandler(() => store.dispatch(clearSession()));

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
	<React.StrictMode>
		<Provider store={store}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</Provider>
	</React.StrictMode>
);
