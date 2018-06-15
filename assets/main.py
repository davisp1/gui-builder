#!/bin/python3

import yaml
import git
import os
import sys
import shutil
import re
import logging
from multiprocessing import Pool

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s:%(levelname)s:%(message)s')

# Create another handler that will redirect log entries to STDOUT
STDOUT_HANDLER = logging.StreamHandler()
STDOUT_HANDLER.setLevel(logging.DEBUG)
STDOUT_HANDLER.setFormatter(formatter)
LOGGER.addHandler(STDOUT_HANDLER)

# Path to fetch viztools repositories
FETCH_VT_PATH = "fetch-vt"

# Path to prepared viztools
VT_PATH = "vt"


def git_remote_ref(url, reference):
    """
    Equivalent to git ls-remote function but returns only the sha1 of the remote reference
    """
    g = git.cmd.Git()
    return g.ls_remote(url, reference).split('\n')[0].split('\t')[0]


def read_list():
    """
    Reads the repo-list.yml file to get the url to viztools
    :return: the dict containing the yaml information
    """
    with open("repo-list.yml", 'r') as input_stream:
        repositories = yaml.load(input_stream)
        return repositories


def extract_repo_name(url):
    """
    Extract the repository name from the url
    (commonly the last part of the URL without ".git" suffix and "vt-" prefix)
    """

    return url.split("/")[-1].replace(".git", "").replace("vt-", "")


def check_vt_validity(vt_name):
    """
    Check viztool repository validity
    """

    # Check if viztool definition is present in repository
    pattern_def = re.compile("viztool_def.json")
    def_found = False
    pattern_manifest = re.compile("manifest.json")
    manifest_found = False
    for file_path in os.listdir("%s/vt-%s" % (FETCH_VT_PATH, vt_name)):
        if pattern_def.match(file_path):
            def_found = True
        if pattern_manifest.match(file_path):
            manifest_found = True
        if def_found and manifest_found:
            break
    else:
        if not def_found:
            LOGGER.warning("[%s] viztool_def.json is missing", vt_name)
        if not manifest_found:
            LOGGER.warning("[%s] manifest.json is missing", vt_name)



# Read repositories list
REPO_LIST = read_list()


def fetch_repo(repository_info):
    # Extract name from repository
    url = repository_info.get('url')
    vt_name = extract_repo_name(url)
    reference = repository_info.get('ref', 'master')
    extract_to_path = "%s/vt-%s" % (FETCH_VT_PATH, vt_name)
    commit_ref = "no_info"
    LOGGER.debug("[%s] Processing ...", vt_name)

    if url[0] == "/":
        # Repository is a local path
        try:
            shutil.rmtree("%s/%s" % (FETCH_VT_PATH, vt_name),
                          ignore_errors=True)
            shutil.copytree(url, "%s/vt-%s" % (FETCH_VT_PATH, vt_name))
            commit_ref = "local_changes"
        except Exception as e:
            LOGGER.warning(
                "[%s] Can't copy from path %s.\n%s", vt_name, url, e)
    else:
        # Repository is a url path

        # If repo already exists, check if there is any change
        try:
            repo = git.Repo(extract_to_path)
            remote_ref = git_remote_ref(url, reference)
            if str(repo.head.commit) == remote_ref:
                # No change since the last run
                LOGGER.info("[%s] No changes detected" % vt_name)
            else:
                # Update HEAD to required reference
                LOGGER.info("[%s] Change detected (%s -> %s)",
                            vt_name, str(repo.head.commit), remote_ref)
                repo.remotes[0].fetch()
                repo.head.reference = repo.commit(reference)

        except git.exc.BadName:
            LOGGER.warning("[%s] Reference %s is not valid. Keeping current reference." % (
                vt_name, reference))
        except git.exc.NoSuchPathError:
            LOGGER.info("[%s] New viztool detected", vt_name)

            # Clone repository
            try:
                repo = git.Repo.clone_from(
                    url=url,
                    to_path=extract_to_path,
                    branch=reference)
                commit_ref = str(repo.commit())
            except Exception as ex:
                LOGGER.warning("[%s] Impossible to clone: \n%s", url, ex)
                return
        except Exception as ex:
            LOGGER.warning("[%s] Unknown exception: \n%s", url, ex)
            return

    # Consistency check
    try:
        check_vt_validity(vt_name)
    except Exception:
        return

    # Copy sources to build path
    ignored_patterns = [
        ".git",
        "changelog.md",
        "manifest.md",
        "viztool_def*.json"
    ]
    ignored = shutil.ignore_patterns(*ignored_patterns)
    shutil.rmtree("%s/%s" % (VT_PATH, vt_name),
                  ignore_errors=True)
    shutil.copytree("%s/vt-%s" % (FETCH_VT_PATH, vt_name),
                    "%s/%s" % (VT_PATH, vt_name),
                    ignore=ignored)
    if os.path.exists("%s/vt-%s/LICENSE" % (FETCH_VT_PATH, vt_name)):
        shutil.copy("%s/vt-%s/LICENSE" % (FETCH_VT_PATH, vt_name),
                    "%s/%s/" % (VT_PATH, vt_name))
    if os.path.exists("%s/vt-%s/README.md" % (FETCH_VT_PATH, vt_name)):
        shutil.copy("%s/vt-%s/README.md" % (FETCH_VT_PATH, vt_name),
                    "%s/%s/" % (VT_PATH, vt_name))
    if os.path.exists("%s/vt-%s/*.json" % (FETCH_VT_PATH, vt_name)):
        shutil.copy("%s/vt-%s/*.json" % (FETCH_VT_PATH, vt_name),
                    "%s/%s/" % (VT_PATH, vt_name))

    repository_info["commit"] = commit_ref
    return repository_info


results = []
with Pool(4) as p:
    # Fetch repositories
    results = p.map(fetch_repo, REPO_LIST)

# Strip failed jobs
results = [x for x in results if x is not None]

# Create viztools Version manifest
with open("%s/versions.yml" % VT_PATH, 'w') as output_stream:
    yaml.dump(results, output_stream, default_flow_style=False)

# Remove the unneeded repositories
repo_list_build = [extract_repo_name(x["url"]) for x in results]
repo_list_build.append("versions.yml")
for viztool_path in os.listdir(FETCH_VT_PATH):
    viztool_name = viztool_path.replace('vt-', '')
    if viztool_name not in repo_list_build:
        shutil.rmtree("%s/%s" % (VT_PATH, viztool_name),
                      ignore_errors=True)
        shutil.rmtree("%s/vt-%s" % (FETCH_VT_PATH, viztool_name),
                      ignore_errors=True)
        LOGGER.info("[%s] removed (unused for this run)", viztool_name)


def show_summary():
    """
    Display summary as debug
    """
    with open("%s/versions.yml" % VT_PATH, 'r') as f:
        for line in f:
            LOGGER.debug(line.rstrip('\n'))


show_summary()
