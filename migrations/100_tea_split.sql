-- Tea leaves and ink blots become two tools (the owner's request of 2026-10-29): tasseomancy (kind 'tea') and ink blots (kind 'blots').
-- Each cup saved before the split moves to kind 'tea'; its seed, tea and everything written about it stay where they are. A person who
-- chose to see the old combined tool in their tool list keeps seeing both halves of it. Safe to run twice.
-- older-versions: no
UPDATE divinations SET kind = 'tea'
WHERE kind = 'blots' AND id IN (SELECT divination_id FROM blot_casts WHERE vessel = 'cup');
UPDATE users SET chosen_tools = chosen_tools || ',tea'
WHERE chosen_tools IS NOT NULL AND 'blots' = ANY(string_to_array(chosen_tools, ',')) AND NOT ('tea' = ANY(string_to_array(chosen_tools, ',')));
