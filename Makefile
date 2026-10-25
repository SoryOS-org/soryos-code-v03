# SoryOS-Code - Makefile

install:
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

clean:
	rm -rf node_modules
	rm -rf apps/web/.next
	rm -rf apps/web/node_modules