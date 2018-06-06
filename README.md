# gui-builder

This project aims at preparing viztools to send to an IKATS instance.

This operation consists in several parts :

- Based on a repository list, fetch the viztools to be used
- Check the integrity of each viztool
- Build the viztools tree
- Update url to connected API services
- Make this tree available to other services

## Quickstart

To build the image

```bash
docker build . -t gui-builder
```

To run the container

```bash
docker run -it \
   -e TOMCAT_ADDR="tomcat_addr:port"
   -e GUNICORN_ADDR="gunicorn_addr:port"
   -e TOMEE_ADDR="tomee_addr:port"
   -e OPENTSDB_ADDR="opentsdb_addr:port"
   -v /path/to/cached/viztools:/app/fetch-vt \
   -v /path/to/shared/gui:/app/build \
   -v /path/to/local/viztools:/app/local \
   -v /path/to/custom/repo-list.yml:/app/repo-list.yml \
   gui-builder
```


## Content of repo-list.yml

`repo-list.yml` is the file that indicates where to fetch the viztools.

It is a [YAML](http://yaml.org/) file describing a list of the following information:

1. **url**: the complete URL to the `git` repository.  
   This may be a:
   - complete https URL (eg. `https://github.com/IKATS/op-quality_stats.git`)
   - local path (see details below)

   If credentials must be provided, use the following format: `https://login:password@company.com/git_repo`
2. **ref**: a `git`reference to the commit to use  
   This may be a:
   - sha1:  (eg. `04c113bc093dc748583690474d81470b39e05cc8`)
   - branch:  (eg. `master`)
   - tag:  (eg. `1.8.2`)
   - relative reference:  (eg. `master^`)

## Volumes

4 volumes are used :

- `/app/fetch-vt`: (*optional*) the path to the fetched viztools to be prepared. Mounting it allows faster startup (act as a *cache*)
- `/app/build`: (*mandatory*) the path to the prepared GUI to be provided to web server
- `/app/repo-list.yml` : (*optional*) to set an external repository list different from the official IKATS viztools
- `/app/local`: (*optional*) if you plan to use local viztool, mount your git workspace here.

## Mounting a local viztool repository

**Assumption:**  
The repository is located on host machine at `/home/developer/vt-mysterious-viztool`

- Mount `/home/developer/vt-mysterious-viztool` to `/app/local/vt-mysterious-viztool`
- In `repo-list.yml` file, set the `url` field of the to `/app/local/vt-mysterious-viztool`

## Common errors

TODO