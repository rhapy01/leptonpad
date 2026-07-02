import "./loadEnv";
import app from "./app";
import { logger } from "./lib/logger";
import { validateSettlementConfig } from "./lib/settlementConfig";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void validateSettlementConfig();
  void import("./lib/blobStorage").then(({ blobStorageEnabled, getBlobStoreId }) => {
    if (blobStorageEnabled()) {
      logger.info({ storeId: getBlobStoreId() ?? "unknown" }, "Media uploads: Vercel Blob");
    } else {
      logger.info("Media uploads: local disk (set BLOB_READ_WRITE_TOKEN for Vercel Blob)");
    }
  });
});
