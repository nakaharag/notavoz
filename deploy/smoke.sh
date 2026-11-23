#!/usr/bin/env bash
# Local integration check using synthetic data, separate volumes and a provider mock.
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export SEED_USERNAME=synthetic SEED_PASSWORD=synthetic-password-only
export JWT_SECRET=synthetic-jwt-secret-with-at-least-32-characters OPENAI_API_KEY=synthetic
export NOTAVOZ_DOMAIN=localhost RELEASE_TAG=smoke
compose=(docker compose --env-file /dev/null -p notavoz-smoke -f docker-compose.prod.yml -f deploy/compose.smoke.yml)
"${compose[@]}" config --quiet
"${compose[@]}" --parallel 1 build
# Leave the isolated volumes for inspection. Never delete the pilot volumes.
trap '"${compose[@]}" down' EXIT
"${compose[@]}" up -d --wait --wait-timeout 120
work=$(mktemp -d)
chmod 700 "$work"
trap 'rm -rf -- "$work"; "${compose[@]}" down' EXIT
base=https://localhost:8443
curl --fail --silent --insecure "$base/" > /dev/null
curl --fail --silent --insecure "$base/api/health" > /dev/null
status=$(curl --silent --insecure -o /dev/null -w '%{http_code}' "$base/api/records")
[[ "$status" == 401 ]]
curl --fail --silent --insecure "$base/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"synthetic","password":"synthetic-password-only"}' > "$work/login.json"
python3 - "$work" <<'PY'
import json, pathlib, sys, wave
p = pathlib.Path(sys.argv[1])
token = json.loads((p / 'login.json').read_text())['token']
(p / 'headers').write_text('Authorization: Bearer ' + token + '\n')
with wave.open(str(p / 'synthetic.wav'), 'wb') as audio:
    audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000)
    audio.writeframes(b'\x00\x00' * 16000)
PY
curl --fail --silent --insecure "$base/api/speech/transcribe" -H "@$work/headers" \
  -F "audio=@$work/synthetic.wav" > "$work/transcript.json"
curl --fail --silent --insecure "$base/api/report/generate" -H "@$work/headers" \
  -H 'Content-Type: application/json' -d '{"text":"Somente texto ficticio."}' > "$work/report.json"
status=$(curl --silent --insecure -o "$work/error.json" -w '%{http_code}' "$base/api/report/generate" \
  -H "@$work/headers" -H 'Content-Type: application/json' -d '{"text":"SIMULATE_MODEL_ERROR"}')
[[ "$status" == 502 ]]
curl --fail --silent --insecure "$base/api/records" -H "@$work/headers" \
  -H 'Content-Type: application/json' -d '{"patientName":"Pessoa Ficticia","rawTranscript":"Dado sintetico persistido."}' > "$work/record.json"
id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$work/record.json")
"${compose[@]}" restart backend
"${compose[@]}" up -d --wait --wait-timeout 120
curl --fail --silent --insecure "$base/api/records/$id" -H "@$work/headers" > "$work/persisted.json"
curl --fail --silent --insecure -X PUT "$base/api/records/$id" -H "@$work/headers" \
  -H 'Content-Type: application/json' -d '{"notes":"Edicao sintetica"}' > /dev/null
curl --fail --silent --insecure -X DELETE "$base/api/records/$id" -H "@$work/headers" > /dev/null
python3 - "$work" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
read = lambda name: json.loads((p / name).read_text())
assert read('transcript.json')['transcription'] == 'Transcricao sintetica do smoke test.'
assert read('report.json')['correctedTranscript'] == 'Texto sintetico corrigido.'
assert read('error.json')['code'] == 'PROVIDER_MODEL'
assert read('persisted.json')['rawTranscript'] == 'Dado sintetico persistido.'
print('PASS: HTTPS, /api, auth, transcription, generation, model failure, CRUD, restart persistence')
PY
