if !has('python') && !has('python3')
	echo 'It looks like your vim does not have python support. Bracey depends on python to run!'
	echo 'Make sure your vim has python2 or python3 support and try again.'
	finish
endif

let s:plugin_path = expand('<sfile>:p:h:h')
let s:script_path = s:plugin_path.'/script/bracey.py'

function! bracey#start()
	if has('python3')
		execute 'py3file '.fnameescape(s:script_path)
	elseif has('python')
		execute 'pyfile '.fnameescape(s:script_path)
	endif

	if g:bracey_auto_start_server
		call bracey#startServer()
	endif

	call bracey#setupHandlers()

	"TODO: find a better way to do this than sleeping
	sleep 1000m
	call bracey#setVars()
	call bracey#setFile()

	if g:bracey_auto_start_browser
		call bracey#startBrowser(g:bracey_server_path.':'.g:bracey_server_port)
	endif
endfunction

function! bracey#startBrowser(url)
	if g:bracey_browser_command == 0
		if has("unix")
			if system("uname -s") =~ "Darwin"
				call system('open '.a:url.' &')
			else
				call system('xdg-open '.a:url.' &')
			endif
		endif
	else
		call system(g:bracey_browser_command.' '.a:url.' &')
	endif
endfunction

function! bracey#startServer()
	if has('python3')
		python3 startServer()
	elseif has('python')
		python startServer()
	endif
endfunction

function! bracey#stopServer()
	if has('python3')
		python3 stopServer()
	elseif has('python')
		python stopServer()
	endif
endfunction

function! bracey#setupHandlers()
	autocmd CursorMoved,CursorMovedI *.html,*.css call bracey#setCursor()
	autocmd TextChanged,TextChangedI *.html,*.css call bracey#bufferChange()
	autocmd BufEnter * call bracey#setFile()
	if g:bracey_eval_on_save
		autocmd BufWritePost *.js call bracey#evalFile()
	endif
	if g:bracey_refresh_on_save
		autocmd BufWritePost *.html call bracey#reload()
	endif
	autocmd VimLeave * call bracey#stop()
endfunction

function! bracey#stop()
	call bracey#stopServer()
endfunction

function! bracey#sendCurrentBuffer()
	let contents = join(getline(1, '$'), "\n")
	call bracey#sendCommand('b:'.strchars(contents).':'.contents)
endfunction

function! bracey#evalFile(...)
	if a:0
		let content = join(a:000, ' ')
		call bracey#sendCommand('e:'.strchars(content).':'.content)
	else
		let contents = join(getline(1, '$'), "\n")
		call bracey#sendCommand('e:'.strchars(contents).':'.contents)
	endif
endfunction

function! bracey#reload()
	let path = expand('%')
	call bracey#sendCommand('r:'.strchars(path).':'.path)
endfunction

function! bracey#setFile()
	let path = expand('%:p')
	let bufname = bufname('%')
	let bufnum = bufnr('%')
	let contents = join(getline(1, '$'), "\n")
	call bracey#sendCommand('f:'.strchars(bufnum).':'.bufnum.':'.strchars(bufname).':'.bufname.':'.strchars(path).':'.path.':'.strchars(&filetype).':'.&filetype.'b:'.strchars(contents).':'.contents)
endfunction

function! bracey#setVars()
	let cwd = getcwd()
	call bracey#sendCommand('v:'.strchars(cwd).':'.cwd)
endfunction

function! bracey#bufferChange()
	"one day... this will be better, but for now... just send the whole buffer
	"every time there is a single change
	"this ends up sending WAY to much (like 1Mb/s according to ifconfig) over
	"the internal ip stack and also probably lags vim a lot if requests aren't async call
	call bracey#sendCurrentBuffer()
endfunction

function! bracey#setCursor()
	let line = line('.')
	let column = col('.')
	call bracey#sendCommand('p:'.strchars(line).':'.line.':'.strchars(column).':'.column)
endfunction

function! bracey#sendCommand(msg)
	if has('python3')
		python3 send(vim.eval("a:msg"))
	elseif has('python')
		python send(vim.eval("a:msg"))
	endif
endfunction
