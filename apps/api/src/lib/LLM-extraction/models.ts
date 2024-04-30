import OpenAI from "openai";
import { Document } from "../../lib/entities";
import { numTokensFromString } from "./helpers";

export type ScraperCompletionResult = {
  data: any | null;
  url: string;
};

const defaultPrompt =
  "You are a professional web scraper. Extract the contents of the webpage";

function prepareOpenAIDoc(
  model: string,
  document: Document
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  // Check if the markdown content exists in the document

  let maxTokens;
  switch(model) {
    case 'gpt-3.5-turbo':
      maxTokens = 3500;
      break;
    case 'gpt-4-turbo':
      maxTokens = 100000;
      break;
    default:
      maxTokens = 3500;
  }

  const numTokens = numTokensFromString(
    document.markdown,
    model
  );

  if (numTokens > maxTokens) {
    document.markdown = trimContentIfTooLong(document.markdown, maxTokens);
  }

  return [{ type: "text", text: document.markdown }];
}

function trimContentIfTooLong(content: string, maxLength: number): string {
  if (content.length > maxLength) {
    return content.substring(0, maxLength);
  }
  return content;
}

export async function generateOpenAICompletions({
  client,
  model = "gpt-3.5-turbo",
  document,
  schema, //TODO - add zod dynamic type checking
  prompt = defaultPrompt,
  temperature,
}: {
  client: OpenAI;
  model?: string;
  document: Document;
  schema: any; // This should be replaced with a proper Zod schema type when available
  prompt?: string;
  temperature?: number;
}): Promise<Document> {
  const openai = client as OpenAI;
  const content = prepareOpenAIDoc(model, document);

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: prompt,
      },
      { role: "user", content },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_content",
          description: "Extracts the content from the given webpage(s)",
          parameters: schema,
        },
      },
    ],
    tool_choice: "auto",
    temperature,
  });

  const c = completion.choices[0].message.tool_calls[0].function.arguments;

  // Extract the LLM extraction content from the completion response
  const llmExtraction = JSON.parse(c);

  // Return the document with the LLM extraction content added
  return {
    ...document,
    llm_extraction: llmExtraction,
  };
}
