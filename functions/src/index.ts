// import { onCall, HttpsError } from "firebase-functions/v2/https";
// import { logger } from "firebase-functions";
// import { initializeApp } from "firebase-admin/app";
// import { HarmBlockThreshold, HarmCategory, VertexAI } from "@google-cloud/vertexai";
// import { getRemoteConfig } from "firebase-admin/remote-config";
// import cors from "cors";

// // Allow all origins. Set origin to restrict domain access.
// const corsMiddleware = cors({ origin: true });

// // Set and check environment variables.
// const project = process.env.GCLOUD_PROJECT;

// // Enable App Check
// const appCheckRequired = true;

// // Initialize Firebase.
// const app = initializeApp();

// // [START remote_config_server_vertex_default_values]
// // Define default (fallback) parameter values for Remote Config.
// const defaultConfig = {
//   model: "gemini-1.5-flash-preview-0514",
//   generationConfig: [
//     {
//       temperature: 0.7,
//       maxOutputTokens: 64,
//       topP: 0.1,
//       topK: 20,
//     },
//   ],
//   prompt: `I'm a developer who wants to learn about Firebase and you are a helpful assistant who knows everything there is to know about Firebase!`,
//   safetySettings: [
//     {
//       category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//     {
//       category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//     {
//       category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//     {
//       category: HarmCategory.HARM_CATEGORY_HARASSMENT,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//   ],
//   location: "asia-south1",
//   vertex_enabled: false,
// };
// // [END remote_config_server_vertex_default_values]

// // [START remote_config_server_vertex_create_function]
// // Export the function.
// exports.callVertexWithRC = onCall(
//   {
//     enforceAppCheck: appCheckRequired, // Enable App Check enforcement
//     consumeAppCheckToken: false, // Don't consume the token (optional)
//   },
//   async (data, context) => {
//     try {
//       // Set up Remote Config.
//       const rc = getRemoteConfig(app);

//       // Get the Remote Config template.
//       const template = await rc.getServerTemplate();

//       // Retrieve config values from Remote Config
//       const textModel = template.getString("model") || defaultConfig.model;
//       const textPrompt = template.getString("prompt") || defaultConfig.prompt;
//       const location = template.getString("location") || defaultConfig.location;
//       const vertexEnabled = template.getBoolean("vertex_enabled") ?? defaultConfig.vertex_enabled;

//       // [END remote_config_server_vertex_create_function]

//       // [START remote_config_server_vertex_function_logic]
//       // Allow user input.
//       const userInput = data?.data?.prompt || "";

//       // Instantiate Vertex AI.
//       const vertexAi = new VertexAI({ project: project, location: location });
//       const generativeModel = vertexAi.getGenerativeModel({
//         model: textModel,
//         safetySettings: defaultConfig.safetySettings,
//         generationConfig: defaultConfig.generationConfig,
//       });

//       // Combine prompt from Remote Config with optional user input.
//       const chatInput = `${textPrompt} ${userInput}`;

//       if (!chatInput.trim()) {
//         throw new HttpsError("invalid-argument", "Missing text prompt");
//       }

//       // Check if Vertex AI is enabled
//       if (!vertexEnabled) {
//         logger.log("Vertex AI is not enabled");
//         return;
//       }

//       logger.log(
//         `\nRunning with model ${textModel}, prompt: ${textPrompt}, generationConfig: ${JSON.stringify(
//           defaultConfig.generationConfig
//         )}, safetySettings: ${JSON.stringify(defaultConfig.safetySettings)} in ${location}\n`
//       );

//       const result = await generativeModel.generateContentStream(chatInput);

//       const chunks: string[] = [];
//       for await (const item of result.stream) {
//         if (item.candidates) {
//           const chunk = item.candidates[0].content.parts[0].text;
//           logger.log("Received chunk:", chunk);
//           chunks.push(chunk);
//         }
//       }

//       return chunks.join(""); // Return the concatenated chunks
//     } catch (error) {
//       logger.error(error);
//       throw new HttpsError("internal", "Internal server error");
//     }
//   }
// );
// // [END remote_config_server_vertex_function_logic]

// Import the Genkit core libraries and plugins.
import { genkit, z } from "genkit";
import { vertexAI, gemini15Flash } from "@genkit-ai/vertexai";

// Import models from the Vertex AI plugin. The Vertex AI API provides access to
// several generative models. Here, we import Gemini 1.5 Flash.
// import {gemini15Flash} from "@genkit-ai/vertexai";

// From the Firebase plugin, import the functions needed to deploy flows using
// Cloud Functions.
import { firebaseAuth } from "@genkit-ai/firebase/auth";
import { onFlow } from "@genkit-ai/firebase/functions";

const ai = genkit({
	plugins: [
		// Load the Vertex AI plugin. You can optionally specify your project ID
		// by passing in a config object; if you don't, the Vertex AI plugin uses
		// the value from the GCLOUD_PROJECT environment variable.
		vertexAI({ location: "asia-south1" }),
	],
});

// Define a simple flow that prompts an LLM to generate menu suggestions.
export const menuSuggestionFlow = onFlow(
	ai,
	{
		name: "menuSuggestionFlow",
		inputSchema: z.string(),
		outputSchema: z.string(),
		authPolicy: firebaseAuth((user) => {
			// By default, the firebaseAuth policy requires that all requests have an
			// `Authorization: Bearer` header containing the user's Firebase
			// Authentication ID token. All other requests are rejected with error
			// 403. If your app client uses the Cloud Functions for Firebase callable
			// functions feature, the library automatically attaches this header to
			// requests.
			// You should also set additional policy requirements as appropriate for
			// your app. For example:
			// if (!user.email_verified) {
			//   throw new Error("Verified email required to run flow");
			// }
		}),
	},
	async (subject) => {
		// Construct a request and send it to the model API.
		const prompt = `Suggest an item for the menu of a ${subject} themed restaurant`;
		const llmResponse = await ai.generate({
			model: gemini15Flash,
			prompt: prompt,
			config: {
				temperature: 1,
			},
		});

		// Handle the response from the model API. In this sample, we just
		// convert it to a string, but more complicated flows might coerce the
		// response into structured output or chain the response into another
		// LLM call, etc.
		return llmResponse.text;
	},
);
