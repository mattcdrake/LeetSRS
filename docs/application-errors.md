# Application errors

Expected failures use `ApplicationFailure` codes and validated parameters from
[the domain contract](../domain/application-error.ts). Only numeric note limits
and backup versions are parameters; credentials, user input, and remote text are
never presentation parameters. Background messages carry an `ApplicationError`
with this payload. Gist results and in-memory sync status carry the same payload.

[The presentation resolver](../i18n/application-errors.ts) applies this fallback policy:

- Known code: use the selected locale's catalog entry.
- Missing or empty entry: use the English entry, including numeric interpolation.
- Unknown code, invalid parameters, legacy string, or unexpected exception: use
  the selected locale's generic retry message. If that entry is missing, use English.
- Existing operation-specific generic messages remain for note saving, export,
  and reset, preserving useful context such as retention of an unsaved note.
- The last-resort popup render boundary sits outside the language provider and
  retains its English fallback. It never displays an exception message or stack.

Popup and content render error text at their presentation boundaries. Gist
outcomes retain codes so a language change also updates already-visible feedback.
Language selection, content translation storage, and subscription lifecycle are unchanged.

Diagnostics retain the operation, validated code/parameters, and HTTP status when
available. They omit exception messages, causes, request/response objects, and
credentials. GitHub failures use structured status and rate-limit headers;
permission denial is distinct from rate limiting. Unclassified failures stay
`unexpected`; they are not guessed from exception text.
