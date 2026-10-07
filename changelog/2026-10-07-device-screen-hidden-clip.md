# Lo schermo live di un Device3D non sopravvive al suo clip

`placeFaces` scriveva `visibility: visible` sulla faccia DOM dello schermo. Hyperframes nasconde
un clip fuori range con `visibility: hidden` sul contenitore, e un figlio `visible` vince sul
padre: finito il clip, l'ultima posa dello schermo (sfondo nero) restava sopra le scene dopo.
Visto nel video demo generic-sites: un quadrilatero nero dietro il logo del claim.

Ora la faccia mostrata toglie lo stile inline (`''`) ed eredita dal clip. Scartato `inherit`:
jsdom non lo risolve, e il test non distinguerebbe i due casi.
