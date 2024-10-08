import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(__dirname, "../.env") });

console.log("API_KEY carregada:", process.env.API_KEY);

import { accessDetranPage } from "./services/detranService";

(async () => {
  await accessDetranPage();
})();
