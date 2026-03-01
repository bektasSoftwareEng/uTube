import sys
with open('c:\\Users\\smila\\Desktop\\Project github\\uTube\\frontend\\src\\pages\\LiveStudio.jsx', 'r', encoding='utf-8') as f: content = f.read()
start = content.find('{/* ═══ Mode Toggle ═══ */}')
end = content.find('{/* ═══ Poll Modal ═══ */}')
newRender = open('c:\\Users\\smila\\Desktop\\Project github\\uTube\\frontend\\src\\pages\\LiveStudio_newRender.txt', 'r', encoding='utf-8').read()
before = content[:content.find('</div>', content.find('</div>', start) + 1) + 6]
after = content[end:]
open('c:\\Users\\smila\\Desktop\\Project github\\uTube\\frontend\\src\\pages\\LiveStudio.jsx', 'w', encoding='utf-8').write(before + '\n' + newRender + '\n                ' + after)
print('Replaced')
