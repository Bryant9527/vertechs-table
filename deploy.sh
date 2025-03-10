#强制推送
#!/usr/bin/env bash
set -e
npm run build
cd dist
touch .nojekyll
git init
git add -A
git commit -m 'deploy'
git push -f "https://${access_token}@gitee.com/yuanzbz/vertechs-table.git" master:gh-pages
git push -f "https://${access_token}@github.com/zouzhibin/vertechs-table.git" master:gh-pages

cd -
exec /bin/bash




