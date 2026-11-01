import { aiFailure, logAiError } from "./ai-log";

// Sends Claude's answer to the browser as it is written. Every Claude route used to carry its own copy of this. The first piece
// of the answer is awaited BEFORE the response is sent, so a refusal (bad key, spending limit, wrong model) comes back as a plain
// error the page can show, and is logged with the real reason, instead of an empty 200 that looks like a blank answer.

interface TextDelta {
  type: string;
  delta?: { type?: string; text?: string };
}

const HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "X-Accel-Buffering": "no",
  "Cache-Control": "no-cache",
};

/**
 * `stream` is the object returned by client.messages.stream(). `onDone` runs after the whole answer has been sent, with its text
 * (for saving it); an error in it is logged and does not break what the person already read.
 */
export async function streamClaude(
  stream: AsyncIterable<unknown>,
  kind: string,
  onDone?: (text: string) => Promise<void>
): Promise<Response> {
  const iterator = stream[Symbol.asyncIterator]();
  let step: IteratorResult<unknown>;
  try {
    step = await iterator.next();
  } catch (err) {
    return aiFailure(kind, err);
  }

  const encoder = new TextEncoder();
  let full = "";
  const readable = new ReadableStream({
    async start(controller) {
      try {
        while (!step.done) {
          const event = step.value as TextDelta;
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && typeof event.delta.text === "string") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
          step = await iterator.next();
        }
        if (onDone && full) await onDone(full);
      } catch (err) {
        // The answer stopped part way, or saving it failed. What was sent stays sent; the reason goes to the log.
        logAiError(kind, err);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(readable, { headers: HEADERS });
}
