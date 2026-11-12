# Asks questions 2-15 on the test phone, one screenshot each (q02..q15).
$qs = @(
  'lap chole closure', 'kittner', 'yankauer?', 'wheres the 12 port', 'what does avery use for hernia',
  'add a bovie to averys hernia setup', 'bovie moved to A2 bin 3', 'add yankauer suction to the library, A1 bin 4',
  'how much cement does patel want', 'take the tacker off the hernia card', 'whats on the closure',
  'TKR setup for patel', 'show me what needs review', 'pt Maria Lopez DOB 04/12/1961 needs extra mesh'
)
$n = 2
foreach ($q in $qs) {
  & "C:\Users\igles\phone app\apps\or-nav-v2\qa\25\ask.ps1" -text $q -name ('q{0:D2}' -f $n) -wait 25
  $n++
}
