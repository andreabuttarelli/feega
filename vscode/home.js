const Home = Object.freeze({ New: 'new', Open: 'open', Pick: 'pick' });

function homeAction(files) {
  if (files.length === 0) {
    return Home.New;
  }

  return files.length === 1 ? Home.Open : Home.Pick;
}

function openOnShow(view, prepare, hide) {
  const shown = async () => {
    const launch = view.visible && (await prepare());
    if (!launch) {
      return;
    }

    await hide();
    launch();
  };
  shown();
  return view.onDidChangeVisibility(shown);
}

module.exports = { Home, homeAction, openOnShow };
