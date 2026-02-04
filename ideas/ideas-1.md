dollar sign for exec (function or macro), works in forms and strings

"two is an $(if (zero? (mod 2 2)) "even" "odd") number."

- quotes inside quotes
- needs a way to unquote?

at-sign for unexec, works on single word or on matched parentheses

$(first @(3 4 5))
-> 3

function definition: (fn (args) body)

period to separate sentences?

let first (fn (a) (nth 1 a)). first @(3 4 5).

files are "data" by default, can use file extension to indicate "code" default?