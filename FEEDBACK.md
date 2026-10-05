# Platform feedback

Required by the hackathon and kept as we build, with dates and versions, not written from
memory at the end. For each piece: what we used it for, what worked, what needs work,
onboarding, and whether we would build with it again.

## Nebius Token Factory

**Used for:** all LLM inference in Newsletter for One, through the OpenAI-compatible chat completions API.

**What worked**
- 2026-09-28: existing key worked first try against `https://api.tokenfactory.nebius.com/v1`.
- `GET /v1/models?verbose=true` returns context length, pricing, quantization, region and rate
  limits per model. Extremely useful to pick a model per task without leaving the terminal.
- `response_format: {"type": "json_object"}` was honored by all four Nemotron models tested.
- Latency for short prompts was 1.2 s to 2.7 s across Nano, Lightning, Super and Ultra.

**What needs work**
- 2026-09-28: reasoning comes back in `message.reasoning` for Nano but in both `reasoning` and
  `reasoning_content` for Lightning and Super, and only `reasoning_content` for Ultra. Clients
  that read one field miss it on other models. One consistent field would help.
- Nemotron 3 Super is listed with `context_length: 262144` here, while NVIDIA markets the model
  with up to 1M tokens. It would help if the model page said explicitly when the served context
  is lower than the model's native maximum, and why.
- 2026-10-05: there is no speech-to-text model in the catalog (no Whisper, no NVIDIA Parakeet
  or Canary in `GET /v1/models`). For a podcast feature we read the transcript publishers ship
  in their feeds instead. An NVIDIA ASR model on Token Factory would complete the open stack.
- 2026-10-05: `chat_template_kwargs: {"enable_thinking": false}` is accepted and works on Nano,
  Lightning and Ultra, but it is not documented next to the models. It changes cost by two
  orders of magnitude, so it deserves a line on every reasoning model's page. `reasoning_effort:
  "low"` is accepted silently and barely changes anything (Nano: 661 output tokens vs 87 without
  it, on the same prompt), which is worse than rejecting it.

**Onboarding:** (to fill: signup, billing, credits)

**Would we build with it again:** (to fill at the end)

## NVIDIA Nemotron models

### nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B
**Used for:** screening and scoring every raw search result (batches of 20, in parallel), and,
with reasoning off, splitting newsletters and podcast transcripts into separate pieces of news.
- 2026-10-05: with `enable_thinking: false`, a full 38K-character podcast transcript (9.3K prompt
  tokens) was split in 2.1 s for $0.0006, and a news episode into 6 correct items in 7 s.

### nvidia/Nemotron-3_5-Lightning
**Used for:** turning the reader's description into a brief, planning searches, and learning from
feedback.
- 2026-09-28: on a trivial JSON task it spent 636 reasoning tokens against 62 output tokens,
  about 10x more than Super on the same prompt. Worth knowing when budgeting `max_tokens`.
- 2026-10-05: reasoning off is not free for judgment. Asked whether "Apple unveils iPhone 18 at
  September event" and "iPhone 18 launch: everything Apple announced" are the same news, it
  answered `true` with reasoning (656 tokens) and `false` without it (6 tokens). Nano and Ultra
  answered `true` both ways. So the duplicate check keeps reasoning on.

### nvidia/Nemotron-3-Ultra-550b-a55b
**Used for:** the editor: writing the issue from the screened sources.
- 2026-09-28: replaced Super as the editor. On the same issue it answered in 5.8 s against
  16 s for Super, for about $0.004 more per issue, with more specific writing.

### nvidia/nemotron-3-super-120b-a12b
**Used for:** first editor, now replaced by Ultra (see above).

## Tavily

**Used for:** every web, news, Reddit and YouTube search it runs for an issue.
