import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import { AppModule } from "./app.module.ts";

const PORT = 8080;

const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
	logger: ["error", "warn"],
});
await app.init();

createServer(app.getHttpAdapter().getInstance()).listen(PORT);

export default httpServerHandler({ port: PORT });
