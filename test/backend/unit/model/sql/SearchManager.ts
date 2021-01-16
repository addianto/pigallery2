import {LocationManager} from '../../../../../src/backend/model/database/LocationManager';
import {SearchManager} from '../../../../../src/backend/model/database/sql/SearchManager';
import {SearchResultDTO} from '../../../../../src/common/entities/SearchResultDTO';
import {Utils} from '../../../../../src/common/Utils';
import {SQLTestHelper} from '../../../SQLTestHelper';
import * as path from 'path';
import {
  ANDSearchQuery,
  DateSearch,
  DistanceSearch,
  OrientationSearch,
  ORSearchQuery,
  RatingSearch,
  ResolutionSearch,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryTypes
} from '../../../../../src/common/entities/SearchQueryDTO';
import {IndexingManager} from '../../../../../src/backend/model/database/sql/IndexingManager';
import {DirectoryDTO} from '../../../../../src/common/entities/DirectoryDTO';
import {TestHelper} from './TestHelper';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SQLConnection} from '../../../../../src/backend/model/database/sql/SQLConnection';
import {DiskMangerWorker} from '../../../../../src/backend/model/threading/DiskMangerWorker';
import {GalleryManager} from '../../../../../src/backend/model/database/sql/GalleryManager';
import {Connection} from 'typeorm';
import {DirectoryEntity} from '../../../../../src/backend/model/database/sql/enitites/DirectoryEntity';
import {GPSMetadata, PhotoDTO, PhotoMetadata} from '../../../../../src/common/entities/PhotoDTO';
import {VideoDTO} from '../../../../../src/common/entities/VideoDTO';
import {MediaDTO} from '../../../../../src/common/entities/MediaDTO';

const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chai = require('chai');

chai.use(deepEqualInAnyOrder);
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;
declare const after: any;
const tmpDescribe = describe;
describe = SQLTestHelper.describe; // fake it os IDE plays nicely (recognize the test)


class IndexingManagerTest extends IndexingManager {

  public async saveToDB(scannedDirectory: DirectoryDTO): Promise<void> {
    return super.saveToDB(scannedDirectory);
  }
}

class GalleryManagerTest extends GalleryManager {

  public async selectParentDir(connection: Connection, directoryName: string, directoryParent: string): Promise<DirectoryEntity> {
    return super.selectParentDir(connection, directoryName, directoryParent);
  }

  public async fillParentDir(connection: Connection, dir: DirectoryEntity): Promise<void> {
    return super.fillParentDir(connection, dir);
  }
}

describe('SearchManager', (sqlHelper: SQLTestHelper) => {
  describe = tmpDescribe;
  let dir: DirectoryDTO;
  /**
   * dir
   * |- v
   * |- p
   * |- p2
   * |-> subDir
   *     |- p_faceLess
   * |-> subDir2
   *     |- p4
   */

  let v: VideoDTO;
  let p: PhotoDTO;
  let p2: PhotoDTO;
  let p_faceLess: PhotoDTO;
  let p4: PhotoDTO;


  const setUpTestGallery = async (): Promise<void> => {
    let directory: DirectoryDTO = TestHelper.getDirectoryEntry();
    const subDir = TestHelper.getDirectoryEntry(directory, 'The Phantom Menace');
    const subDir2 = TestHelper.getDirectoryEntry(directory, 'Return of the Jedi');
    TestHelper.getPhotoEntry1(directory);
    TestHelper.getPhotoEntry2(directory);
    TestHelper.getPhotoEntry4(subDir2);
    const pFaceLess = TestHelper.getPhotoEntry3(subDir);
    delete pFaceLess.metadata.faces;
    TestHelper.getVideoEntry1(directory);

    await ObjectManagers.InitSQLManagers();
    const connection = await SQLConnection.getConnection();
    ObjectManagers.getInstance().IndexingManager.indexDirectory = () => Promise.resolve(null);


    const im = new IndexingManagerTest();
    await im.saveToDB(directory);
    // await im.saveToDB(subDir);
    // await im.saveToDB(subDir2);

    if (ObjectManagers.getInstance().IndexingManager &&
      ObjectManagers.getInstance().IndexingManager.IsSavingInProgress) {
      await ObjectManagers.getInstance().IndexingManager.SavingReady;
    }

    const gm = new GalleryManagerTest();
    directory = await gm.selectParentDir(connection, directory.name, path.join(path.dirname('.'), path.sep));
    await gm.fillParentDir(connection, <any>directory);

    const populateDir = async (d: DirectoryDTO) => {
      for (let i = 0; i < d.directories.length; i++) {
        d.directories[i] = await gm.selectParentDir(connection, d.directories[i].name,
          path.join(DiskMangerWorker.pathFromParent(d), path.sep));
        await gm.fillParentDir(connection, <any>d.directories[i]);
        await populateDir(d.directories[i]);
      }
    };
    await populateDir(directory);

    await ObjectManagers.reset();

    dir = directory;
    p = <any>dir.media[0];
    p2 = <any>dir.media[1];
    v = <any>dir.media[2];
    p4 = <any>dir.directories[1].media[0];
    p_faceLess = <any>dir.directories[0].media[0];
  };

  const setUpSqlDB = async () => {
    await sqlHelper.initDB();
    await setUpTestGallery();
    /*
        const savePhoto = async (photo: PhotoDTO) => {
          const savedPhoto = await pr.save(photo);
          if (!photo.metadata.faces) {
            return;
          }
          for (let i = 0; i < photo.metadata.faces.length; i++) {
            const face = photo.metadata.faces[i];
            const person = await conn.getRepository(PersonEntry).save({name: face.name});
            await conn.getRepository(FaceRegionEntry).save({box: face.box, person: person, media: savedPhoto});
          }
        };
        const conn = await SQLConnection.getConnection();

        const pr = conn.getRepository(PhotoEntity);

        await conn.getRepository(DirectoryEntity).save(p.directory);
        await savePhoto(p);
        await savePhoto(p2);
        await savePhoto(p_faceLess);

        await conn.getRepository(VideoEntity).save(v);*/

    //  await SQLConnection.close();
  };


  beforeEach(async () => {
    await setUpSqlDB();
  });


  after(async () => {
    await sqlHelper.clearDB();
  });
  /*
    it('should get autocomplete', async () => {
      const sm = new SearchManager();

      const cmp = (a: AutoCompleteItem, b: AutoCompleteItem) => {
        if (a.text === b.text) {
          return a.type - b.type;
        }
        return a.text.localeCompare(b.text);
      };

      expect((await sm.autocomplete('tat'))).to.deep.equalInAnyOrder([new AutoCompleteItem('Tatooine', SearchTypes.position)]);
      expect((await sm.autocomplete('star'))).to.deep.equalInAnyOrder([new AutoCompleteItem('star wars', SearchTypes.keyword),
        new AutoCompleteItem('death star', SearchTypes.keyword)]);

      expect((await sm.autocomplete('wars'))).to.deep.equalInAnyOrder([new AutoCompleteItem('star wars', SearchTypes.keyword),
        new AutoCompleteItem('wars dir', SearchTypes.directory)]);

      expect((await sm.autocomplete('arch'))).eql([new AutoCompleteItem('Research City', SearchTypes.position)]);

      Config.Client.Search.AutoComplete.maxItemsPerCategory = 99999;
      expect((await sm.autocomplete('a')).sort(cmp)).eql([
        new AutoCompleteItem('Boba Fett', SearchTypes.keyword),
        new AutoCompleteItem('Boba Fett', SearchTypes.person),
        new AutoCompleteItem('star wars', SearchTypes.keyword),
        new AutoCompleteItem('Anakin', SearchTypes.keyword),
        new AutoCompleteItem('Anakin Skywalker', SearchTypes.person),
        new AutoCompleteItem('Luke Skywalker', SearchTypes.person),
        new AutoCompleteItem('Han Solo', SearchTypes.person),
        new AutoCompleteItem('death star', SearchTypes.keyword),
        new AutoCompleteItem('Padmé Amidala', SearchTypes.person),
        new AutoCompleteItem('Obivan Kenobi', SearchTypes.person),
        new AutoCompleteItem('Arvíztűrő Tükörfúrógép', SearchTypes.person),
        new AutoCompleteItem('Padmé Amidala', SearchTypes.keyword),
        new AutoCompleteItem('Natalie Portman', SearchTypes.keyword),
        new AutoCompleteItem('Han Solo\'s dice', SearchTypes.photo),
        new AutoCompleteItem('Kamino', SearchTypes.position),
        new AutoCompleteItem('Tatooine', SearchTypes.position),
        new AutoCompleteItem('wars dir', SearchTypes.directory),
        new AutoCompleteItem('Research City', SearchTypes.position)].sort(cmp));

      Config.Client.Search.AutoComplete.maxItemsPerCategory = 1;
      expect((await sm.autocomplete('a')).sort(cmp)).eql([
        new AutoCompleteItem('Anakin', SearchTypes.keyword),
        new AutoCompleteItem('star wars', SearchTypes.keyword),
        new AutoCompleteItem('death star', SearchTypes.keyword),
        new AutoCompleteItem('Anakin Skywalker', SearchTypes.person),
        new AutoCompleteItem('Han Solo\'s dice', SearchTypes.photo),
        new AutoCompleteItem('Kamino', SearchTypes.position),
        new AutoCompleteItem('Research City', SearchTypes.position),
        new AutoCompleteItem('wars dir', SearchTypes.directory),
        new AutoCompleteItem('Boba Fett', SearchTypes.keyword)].sort(cmp));
      Config.Client.Search.AutoComplete.maxItemsPerCategory = 5;

      expect((await sm.autocomplete('sw')).sort(cmp)).to.deep.equalInAnyOrder([new AutoCompleteItem('sw1', SearchTypes.photo),
        new AutoCompleteItem('sw2', SearchTypes.photo), new AutoCompleteItem(v.name, SearchTypes.video)].sort(cmp));

      expect((await sm.autocomplete(v.name)).sort(cmp)).to.deep.equalInAnyOrder([new AutoCompleteItem(v.name, SearchTypes.video)]);

    });
  */
  /*
    it('should search', async () => {
      const sm = new SearchManager();


      expect(Utils.clone(await sm.search('sw', null))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'sw',
        searchType: null,
        directories: [],
        media: [p, p2, v],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('Boba', null))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'Boba',
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('Tatooine', SearchTypes.position))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'Tatooine',
        searchType: SearchTypes.position,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('ortm', SearchTypes.keyword))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'ortm',
        searchType: SearchTypes.keyword,
        directories: [],
        media: [p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('ortm', SearchTypes.keyword))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'ortm',
        searchType: SearchTypes.keyword,
        directories: [],
        media: [p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('wa', SearchTypes.keyword))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'wa',
        searchType: SearchTypes.keyword,
        directories: [dir],
        media: [p, p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('han', SearchTypes.photo))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'han',
        searchType: SearchTypes.photo,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('sw', SearchTypes.video))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'sw',
        searchType: SearchTypes.video,
        directories: [],
        media: [v],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('han', SearchTypes.keyword))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'han',
        searchType: SearchTypes.keyword,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.search('Boba', SearchTypes.person))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: 'Boba',
        searchType: SearchTypes.person,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));
    });
  */

  const searchifyMedia = (m: MediaDTO): MediaDTO => {
    const tmpM = m.directory.media;
    const tmpD = m.directory.directories;
    const tmpMT = m.directory.metaFile;
    delete m.directory.directories;
    delete m.directory.media;
    delete m.directory.metaFile;
    const ret = Utils.clone(m);
    if ((ret.metadata as PhotoMetadata).faces && !(ret.metadata as PhotoMetadata).faces.length) {
      delete (ret.metadata as PhotoMetadata).faces;
    }
    m.directory.directories = tmpD;
    m.directory.media = tmpM;
    m.directory.metaFile = tmpMT;
    return ret;
  };

  const removeDir = (result: SearchResultDTO) => {
    result.media = result.media.map(m => searchifyMedia(m));
    return Utils.clone(result);
  };

  describe('advanced search', async () => {

    it('should AND', async () => {
      const sm = new SearchManager();

      let query: SearchQueryDTO = <ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [<TextSearch>{text: p.metadata.faces[0].name, type: SearchQueryTypes.person},
          <TextSearch>{text: p2.metadata.caption, type: SearchQueryTypes.caption}]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));
      query = <ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [<TextSearch>{text: p.metadata.faces[0].name, type: SearchQueryTypes.person},
          <TextSearch>{text: p.metadata.caption, type: SearchQueryTypes.caption}]
      };
      expect(await sm.aSearch(query)).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      // make sure that this shows both photos. We need this the the rest of the tests
      query = <TextSearch>{text: 'a', type: SearchQueryTypes.person};
      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      }));

      query = <ANDSearchQuery>{
        type: SearchQueryTypes.AND,
        list: [<ANDSearchQuery>{
          type: SearchQueryTypes.AND,
          list: [<TextSearch>{text: 'a', type: SearchQueryTypes.person},
            <TextSearch>{text: p.metadata.keywords[0], type: SearchQueryTypes.keyword}]
        },
          <TextSearch>{text: p.metadata.caption, type: SearchQueryTypes.caption}
        ]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

    });

    it('should OR', async () => {
      const sm = new SearchManager();

      let query: SearchQueryDTO = <ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [<TextSearch>{text: 'Not a person', type: SearchQueryTypes.person},
          <TextSearch>{text: 'Not a caption', type: SearchQueryTypes.caption}]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));
      query = <ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [<TextSearch>{text: p.metadata.faces[0].name, type: SearchQueryTypes.person},
          <TextSearch>{text: p2.metadata.caption, type: SearchQueryTypes.caption}]
      };
      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      }));

      query = <ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [<TextSearch>{text: p.metadata.faces[0].name, type: SearchQueryTypes.person},
          <TextSearch>{text: p.metadata.caption, type: SearchQueryTypes.caption}]
      };
      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      // make sure that this shows both photos. We need this the the rest of the tests
      query = <TextSearch>{text: 'a', type: SearchQueryTypes.person};
      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      }));

      query = <ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [<ORSearchQuery>{
          type: SearchQueryTypes.OR,
          list: [<TextSearch>{text: 'a', type: SearchQueryTypes.person},
            <TextSearch>{text: p.metadata.keywords[0], type: SearchQueryTypes.keyword}]
        },
          <TextSearch>{text: p.metadata.caption, type: SearchQueryTypes.caption}
        ]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      }));


      query = <ORSearchQuery>{
        type: SearchQueryTypes.OR,
        list: [<ORSearchQuery>{
          type: SearchQueryTypes.OR,
          list: [<TextSearch>{text: p.metadata.keywords[0], type: SearchQueryTypes.keyword},
            <TextSearch>{text: p2.metadata.keywords[0], type: SearchQueryTypes.keyword}]
        },
          <TextSearch>{text: p_faceLess.metadata.caption, type: SearchQueryTypes.caption}
        ]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

    });


    it('should minimum of', async () => {
      const sm = new SearchManager();

      let query: SomeOfSearchQuery = <SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        list: [<TextSearch>{text: 'jpg', type: SearchQueryTypes.file_name},
          <TextSearch>{text: 'mp4', type: SearchQueryTypes.file_name}]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p_faceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      }));

      query = <SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        list: [<TextSearch>{text: 'R2', type: SearchQueryTypes.person},
          <TextSearch>{text: 'Anakin', type: SearchQueryTypes.person},
          <TextSearch>{text: 'Luke', type: SearchQueryTypes.person}]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      }));


      query.min = 2;

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p4],
        metaFile: [],
        resultOverflow: false
      }));

      query.min = 3;

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));

      query = <SomeOfSearchQuery>{
        type: SearchQueryTypes.SOME_OF,
        min: 3,
        list: [<TextSearch>{text: 'sw', type: SearchQueryTypes.file_name},
          <TextSearch>{text: 'R2', type: SearchQueryTypes.person},
          <TextSearch>{text: 'Kamino', type: SearchQueryTypes.position},
          <TextSearch>{text: 'Han', type: SearchQueryTypes.person}]
      };

      expect(Utils.clone(await sm.aSearch(query))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p2],
        metaFile: [],
        resultOverflow: false
      }));

    });

    describe('should search text', async () => {
      it('as any', async () => {
        const sm = new SearchManager();

        expect(Utils.clone(await sm.aSearch(<TextSearch>{text: 'sw', type: SearchQueryTypes.any_text})))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p, p2, p_faceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        }));


        expect(Utils.clone(await sm.aSearch(<TextSearch>{text: 'sw', negate: true, type: SearchQueryTypes.any_text})))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{text: 'Boba', type: SearchQueryTypes.any_text})))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{text: 'Boba', negate: true, type: SearchQueryTypes.any_text})))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p2, p_faceLess, p4],
          metaFile: [],
          resultOverflow: false
        }));

        // all should have faces
        const sRet = await sm.aSearch(<TextSearch>{text: 'Boba', negate: true, type: SearchQueryTypes.any_text});
        for (let i = 0; i < sRet.media.length; ++i) {
          if (sRet.media[i].id === p_faceLess.id) {
            continue;
          }
          console.log(sRet.media[i]);
          expect((<PhotoDTO>sRet.media[i]).metadata.faces).to.be.not.an('undefined');
          expect((<PhotoDTO>sRet.media[i]).metadata.faces).to.be.lengthOf.above(1);
        }


        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'Boba',
          type: SearchQueryTypes.any_text,
          matchType: TextSearchQueryTypes.exact_match
        })))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'Boba Fett',
          type: SearchQueryTypes.any_text,
          matchType: TextSearchQueryTypes.exact_match
        })))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        }));

      });

      it('as position', async () => {
        const sm = new SearchManager();

        expect(Utils.clone(await sm.aSearch(<TextSearch>{text: 'Tatooine', type: SearchQueryTypes.position})))
          .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        }));

      });


      it('as keyword', async () => {
        const sm = new SearchManager();


        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'kie',
          type: SearchQueryTypes.keyword
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p2, p_faceLess],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'wa',
          type: SearchQueryTypes.keyword
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p, p2, p_faceLess, p4],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'han',
          type: SearchQueryTypes.keyword
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        }));

      });


      it('as caption', async () => {
        const sm = new SearchManager();

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'han',
          type: SearchQueryTypes.caption
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        }));
      });

      it('as file_name', async () => {
        const sm = new SearchManager();

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'sw',
          type: SearchQueryTypes.file_name
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p, p2, p_faceLess, v, p4],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'sw4',
          type: SearchQueryTypes.file_name
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        }));

      });

      it('as directory', async () => {
        const sm = new SearchManager();

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'of the J',
          type: SearchQueryTypes.directory
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'wars dir',
          type: SearchQueryTypes.directory
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p, p2, v, p_faceLess, p4],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: '/wars dir',
          matchType: TextSearchQueryTypes.exact_match,
          type: SearchQueryTypes.directory
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p, p2, v],
          metaFile: [],
          resultOverflow: false
        }));


        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: '/wars dir/Return of the Jedi',
          matchType: TextSearchQueryTypes.exact_match,
          type: SearchQueryTypes.directory
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: '/wars dir/Return of the Jedi',
          matchType: TextSearchQueryTypes.exact_match,
          type: SearchQueryTypes.directory
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p4],
          metaFile: [],
          resultOverflow: false
        }));


      });

      it('as person', async () => {
        const sm = new SearchManager();

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'Boba',
          type: SearchQueryTypes.person
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'Boba',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryTypes.exact_match
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [],
          metaFile: [],
          resultOverflow: false
        }));

        expect(Utils.clone(await sm.aSearch(<TextSearch>{
          text: 'Boba Fett',
          type: SearchQueryTypes.person,
          matchType: TextSearchQueryTypes.exact_match
        }))).to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
          searchText: null,
          searchType: null,
          directories: [],
          media: [p],
          metaFile: [],
          resultOverflow: false
        }));

      });

    });


    it('should search date', async () => {
      const sm = new SearchManager();

      expect(Utils.clone(await sm.aSearch(<DateSearch>{before: 0, after: 0, type: SearchQueryTypes.date})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<DateSearch>{
        before: p.metadata.creationDate,
        after: p.metadata.creationDate, type: SearchQueryTypes.date
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<DateSearch>{
        before: p.metadata.creationDate,
        after: p.metadata.creationDate,
        negate: true,
        type: SearchQueryTypes.date
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p2, p_faceLess, p4, v],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<DateSearch>{
        before: p.metadata.creationDate + 1000000000,
        after: 0, type: SearchQueryTypes.date
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p_faceLess, v, p4],
        metaFile: [],
        resultOverflow: false
      }));

    });


    it('should search rating', async () => {
      const sm = new SearchManager();

      expect(Utils.clone(await sm.aSearch(<RatingSearch>{min: 0, max: 0, type: SearchQueryTypes.rating})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<RatingSearch>{min: 0, max: 5, type: SearchQueryTypes.rating})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<RatingSearch>{min: 0, max: 5, negate: true, type: SearchQueryTypes.rating})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<RatingSearch>{min: 2, max: 2, type: SearchQueryTypes.rating})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p2],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<RatingSearch>{min: 2, max: 2, negate: true, type: SearchQueryTypes.rating})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));
    });


    it('should search resolution', async () => {
      const sm = new SearchManager();

      expect(Utils.clone(await sm.aSearch(<ResolutionSearch>{min: 0, max: 0, type: SearchQueryTypes.resolution})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<ResolutionSearch>{max: 1, type: SearchQueryTypes.resolution})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, v],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<ResolutionSearch>{min: 2, max: 3, type: SearchQueryTypes.resolution})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<ResolutionSearch>{min: 2, max: 3, negate: true, type: SearchQueryTypes.resolution})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, v, p4],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<ResolutionSearch>{min: 3, type: SearchQueryTypes.resolution})))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p4],
        metaFile: [],
        resultOverflow: false
      }));

    });


    it('should search orientation', async () => {
      const sm = new SearchManager();

      expect(Utils.clone(await sm.aSearch(<OrientationSearch>{
        landscape: false,
        type: SearchQueryTypes.orientation
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2, p4, v],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<OrientationSearch>{
        landscape: true,
        type: SearchQueryTypes.orientation
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p_faceLess, v],
        metaFile: [],
        resultOverflow: false
      }));


    });

    it('should search  distance', async () => {
      ObjectManagers.getInstance().LocationManager = new LocationManager();
      const sm = new SearchManager();

      ObjectManagers.getInstance().LocationManager.getGPSData = async (): Promise<GPSMetadata> => {
        return {
          longitude: 10,
          latitude: 10,
          altitude: 0
        };
      };
      expect(Utils.clone(await sm.aSearch(<DistanceSearch>{
        from: {text: 'Tatooine'},
        distance: 1,
        type: SearchQueryTypes.distance
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<DistanceSearch>{
        from: {GPSData: {latitude: 0, longitude: 0}},
        distance: 112 * 10, // number of km per degree = ~111km
        type: SearchQueryTypes.distance
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p2],
        metaFile: [],
        resultOverflow: false
      }));


      expect(Utils.clone(await sm.aSearch(<DistanceSearch>{
        from: {GPSData: {latitude: 0, longitude: 0}},
        distance: 112 * 10, // number of km per degree = ~111km
        negate: true,
        type: SearchQueryTypes.distance
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p_faceLess, p4],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<DistanceSearch>{
        from: {GPSData: {latitude: 10, longitude: 10}},
        distance: 1,
        type: SearchQueryTypes.distance
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.aSearch(<DistanceSearch>{
        from: {GPSData: {latitude: 10, longitude: 10}},
        distance: 112 * 5, // number of km per degree = ~111km
        type: SearchQueryTypes.distance
      })))
        .to.deep.equalInAnyOrder(removeDir(<SearchResultDTO>{
        searchText: null,
        searchType: null,
        directories: [],
        media: [p, p_faceLess, p4],
        metaFile: [],
        resultOverflow: false
      }));

    });

  });
  /*
    it('should instant search', async () => {
      const sm = new SearchManager();

      expect(Utils.clone(await sm.instantSearch('sw'))).to.deep.equalInAnyOrder(Utils.clone({
        searchText: 'sw',
        directories: [],
        media: [p, p2, v],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.instantSearch('Tatooine'))).to.deep.equalInAnyOrder(Utils.clone({
        searchText: 'Tatooine',
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.instantSearch('ortm'))).to.deep.equalInAnyOrder(Utils.clone({
        searchText: 'ortm',
        directories: [],
        media: [p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));


      expect(Utils.clone(await sm.instantSearch('wa'))).to.deep.equalInAnyOrder(Utils.clone({
        searchText: 'wa',
        directories: [dir],
        media: [p, p2, p_faceLess],
        metaFile: [],
        resultOverflow: false
      }));

      expect(Utils.clone(await sm.instantSearch('han'))).to.deep.equalInAnyOrder(Utils.clone({
        searchText: 'han',
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));
      expect(Utils.clone(await sm.instantSearch('Boba'))).to.deep.equalInAnyOrder(Utils.clone({
        searchText: 'Boba',
        directories: [],
        media: [p],
        metaFile: [],
        resultOverflow: false
      }));
    });
  */

});
