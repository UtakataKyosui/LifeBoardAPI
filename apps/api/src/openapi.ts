import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

export function createOpenApiDocument(app: INestApplication) {
	const config = new DocumentBuilder().setTitle("LifeBoard API").setVersion("0.0.0").build();
	return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

export function setupOpenApi(app: INestApplication) {
	SwaggerModule.setup("openapi", app, createOpenApiDocument(app), {
		swaggerUiEnabled: false,
		jsonDocumentUrl: "openapi.json",
	});
}
