@echo off
cd /d "%~dp0"

REM --- Compile sources into bin (creates bin if missing) ---
if not exist bin (
	mkdir bin
)

echo Compiling Java sources (recursive)...

REM pick javac from JAVA_HOME if available
if defined JAVA_HOME (
	set "JAVAC_EXEC=%JAVA_HOME%\bin\javac.exe"
) else (
	set "JAVAC_EXEC=javac"
)

REM Create a temporary list of all .java files under src/main/java
if exist .javac_sources.txt del .javac_sources.txt
for /r src\main\java %%f in (*.java) do @echo %%~f >> .javac_sources.txt

if not exist .javac_sources.txt (
	echo No Java source files found under src\main\java
	pause
	exit /b 1
)

REM Run javac with the list file (shows compiler errors directly)
"%JAVAC_EXEC%" -encoding UTF-8 -d bin @.javac_sources.txt
if %ERRORLEVEL% NEQ 0 (
	echo.
	echo Compilation failed. See errors printed above.
	echo The file ".javac_sources.txt" contains the list of compiled sources.
	pause
	exit /b %ERRORLEVEL%
)

del .javac_sources.txt

REM --- Choose java executable: use JAVA_HOME if set otherwise rely on PATH ---
if defined JAVA_HOME (
	set "JAVA_EXEC=%JAVA_HOME%\bin\java.exe"
) else (
	set "JAVA_EXEC=java"
)

echo Running main.java.Main
"%JAVA_EXEC%" -cp bin main.java.Main
