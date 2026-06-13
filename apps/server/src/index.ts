import { createApp } from "./app";
import { config } from "./config";

const { httpServer } = createApp();

httpServer.listen(config.PORT, () => {
  console.log(`Popcorn server listening on http://localhost:${config.PORT}`);
});
