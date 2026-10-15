#!/usr/bin/env bash
# Проверка перед слиянием (v0.76): сквозной проход главы, бой с боссом, «обезьяна» со случайным вводом
# и детектором застреваний, снимки всех комнат. Ошибки в консоли = провал.
# Запуск: npm run bots            (быстро: BOTS_QUICK=1 npm run bots — без «обезьяны» и босса)
cd "$(dirname "$0")/../.." || exit 1
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
export KN_OUT="${KN_OUT:-tools/bots/out}"
mkdir -p "$KN_OUT"
if ! curl -s -o /dev/null http://localhost:8080/; then (python3 -m http.server 8080 >/dev/null 2>&1 &); sleep 1; fi
fail=0
run() { local name=$1; shift; echo "== $name"; if ! timeout 900 node "$@" > "$KN_OUT/$name.log" 2>&1; then echo "   УПАЛ (см. $KN_OUT/$name.log)"; fail=1; fi
  grep -E "errors|ЗАСТРЯЛ|СОСТОЯНИЕ|Конец главы|итог" "$KN_OUT/$name.log" | tail -3 | sed 's/^/   /'
  if grep -qE "errors \[[^]]|ЗАСТРЯЛ|СОСТОЯНИЕ" "$KN_OUT/$name.log"; then fail=1; fi; }
run chapter tools/bots/chapter.cjs
grep -q "Конец главы" "$KN_OUT/chapter.log" || { echo "   глава не пройдена до конца"; fail=1; }
run rooms tools/bots/rooms.cjs cell:160 hall:200 hall:1300 hall:2250 secret:160 gallery:200 gallery:1000 shop:160 armory:200 guardroom:160 \
  barracks:200 corridor:200 corridor:650 dining:200 balcony:200 landing2:200 hall2:200 hall2:1300 camp:200 library:200 chapel:200 reading:160 \
  vestry:160 landing3:180 hall3:200 hall3:1150 guardhall:200 stairs3:160 tower:160 mage:200 wardrobe:200 catlib:200
run alkima tools/bots/alkima.cjs
grep -q 'alkima_done' "$KN_OUT/alkima.log" || { echo "   квест Алкимы не пройден"; fail=1; }
run library tools/bots/library.cjs
grep -q 'diary_2' "$KN_OUT/library.log" && grep -q 'diary_1' "$KN_OUT/library.log" || { echo "   библиотека/страницы не пройдены"; fail=1; }
if [ -z "$BOTS_QUICK" ]; then
  run boss tools/bots/boss.cjs 0.2 turn 60
  for r in "hall 300" "gallery 160" "hall2 300"; do set -- $r; run "monkey_$1" tools/bots/monkey.cjs $1 $2 250; done
fi
[ $fail = 0 ] && echo "ВСЁ ЧИСТО" || echo "ЕСТЬ ПРОБЛЕМЫ"
exit $fail
